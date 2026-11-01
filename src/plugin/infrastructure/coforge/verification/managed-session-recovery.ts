import type { AgentJob } from '../../../features/coforge/domain/types';
import { isManagedWorkflowSession } from '../../../features/coforge/domain/workflow-lifecycle';
import { currentWorkspaceAttempt } from '../../../features/coforge/domain/workflow-execution-step';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import type { StudioStore } from '../../../features/coforge/application/studio-store';
import type { InternalState } from '../../../features/coforge/application/ports';
import { appendWorkflowArtifact, configuredChanges, projectWorkflowChanges } from '../../../features/coforge/application/configured-workflow-policy';
import { polishingSaveOptions } from '../../../features/coforge/application/polishing-save-options';
import { nativeCodingIncrement } from '../../../features/coforge/application/native-coding-increment';
import { ProviderFailureError, providerFailureFor } from '../../../features/coforge/domain/provider-failure';

function available(state: InternalState, job: AgentJob): boolean {
  const snapshot = job.workflow, process = job.nativeProcess;
  return !!snapshot?.workspaceId && isManagedWorkflowSession(snapshot) && !job.durable && ['failed', 'cancelled'].includes(job.status)
    && ['claude', 'codex'].includes(job.provider) && process?.phase === 'terminated' && !!process.lifetime
    && process.runId === snapshot.runId && process.attemptId === snapshot.attemptId && process.projectId === job.projectId
    && !job.nativeRuntime && !process.privateRuntime && !job.verificationRuntime?.some(record => record.phase !== 'terminal')
    && !state.jobs.some(other => other.id !== job.id && ['queued', 'running'].includes(other.status)
      && (other.ideaId === job.ideaId || other.workflow?.workspaceId === snapshot.workspaceId));
}

/** Restore original stopped resources, never rerun a provider or infer cessation from a closed connection. */
export async function recoverManagedSessionWorkspace(store: StudioStore, jobId: string, workspaces: WorkflowWorkspaces): Promise<void> {
  const state = store.internalSnapshot(), original = state.jobs.find(job => job.id === jobId);
  if (!original || !available(state, original) || !workspaces.recoverStopped) return;
  const { run, snapshot } = configuredChanges(state, original);
  const captured = run.artifacts.some(artifact => artifact.hostSnapshot && artifact.attemptId === snapshot.attemptId);
  const ownership = JSON.stringify({ workflow: original.workflow, nativeProcess: original.nativeProcess });
  const value = await workspaces.recoverStopped({ workspaceId: snapshot.workspaceId!, runId: snapshot.runId,
    projectId: original.projectId!, attemptId: snapshot.attemptId, capture: !captured })
    .catch(() => { throw new ProviderFailureError(providerFailureFor('workspace_validation')); });
  const increment = value && snapshot.worktreeCoding ? nativeCodingIncrement(value) : value;
  await store.transaction(next => {
    const job = next.jobs.find(job => job.id === jobId);
    if (!job || !available(next, job) || JSON.stringify({ workflow: job.workflow, nativeProcess: job.nativeProcess }) !== ownership)
      throw new Error('The original agent resource changed during automatic recovery. Its retained evidence was not reassigned.');
    const { idea, run: owner, snapshot: retained } = configuredChanges(next, job);
    if (!captured && !owner.artifacts.some(artifact => artifact.hostSnapshot && artifact.attemptId === retained.attemptId)) {
      const at = new Date().toISOString();
      appendWorkflowArtifact(owner, retained, { output: 'codechange', hostSnapshot: true,
        summary: increment?.summary ?? 'No retained code changes after the original session stopped.', ...(increment ? { increment } : {}) }, at);
      if (idea.workflowRun?.id === owner.id && currentWorkspaceAttempt(owner, retained.attemptId)
        && !next.workflowStopHolds?.includes(idea.id) && !['shipped', 'rejected'].includes(idea.status)) projectWorkflowChanges(idea, owner);
      owner.revision++; owner.updatedAt = at;
    }
    const message = 'Original agent session cleanup completed automatically. No agent was restarted.';
    if (!job.logs.includes(message)) job.logs = [...job.logs, message].slice(-200);
  }, polishingSaveOptions(original, () => store.internalSnapshot()));
}
