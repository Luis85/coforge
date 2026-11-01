import type { AgentJob, Idea } from '../../../features/coforge/domain/types';
import type { WorkflowArtifact, WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowArtifactCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { workflowVerificationRecordCheck, type WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';
import { ideaProjectId } from '../../../features/coforge/domain/projects';

export interface PostBuildVerification {
  id: string; name: string; jobStatus: string; records: WorkflowVerificationRecord[]; currentHash?: string;
}
const STATUS: Record<AgentJob['status'], string> = { queued: 'Queued', running: 'Running', succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled' };

/** Job evidence remains a review snapshot; only a captured Build fingerprint can establish a current match. */
export function postBuildVerification(idea: Idea, jobs: readonly AgentJob[], run: WorkflowRun, build: WorkflowArtifact, buildIndex: number,
  artifacts: readonly WorkflowArtifact[]): PostBuildVerification[] {
  const sourceIds = new Set(artifacts.filter(artifact => artifact.stepId === build.stepId && artifact.attemptId === build.attemptId && artifact.increment).map(artifact => artifact.id));
  const seen = new Set((idea.increment?.verification ?? []).map(record => record.id));
  if (!run.workspaceId) return [];
  return run.definition.steps.flatMap((step, index) => {
    if (index <= buildIndex || step.kind !== 'ai' || step.access !== 'readproject') return [];
    const attempt = [...run.attempts].reverse().find(attempt => attempt.stepId === step.id);
    if (!attempt || !['running', 'succeeded', 'failed', 'cancelled'].includes(attempt.status) || Date.parse(attempt.startedAt) < Date.parse(build.createdAt)) return [];
    const job = jobs.find(job => job.id === attempt.jobId && job.ideaId === idea.id && job.projectId === ideaProjectId(idea) && job.status === attempt.status && ['claude', 'codex'].includes(job.provider));
    const captured = job?.workflow;
    if (!job || !captured || captured.runId !== run.id || captured.attemptId !== attempt.id || captured.proposalRevision !== run.proposalRevision
      || captured.definitionRevision !== run.definition.revision || captured.workspaceId !== run.workspaceId || captured.step.id !== step.id || captured.step.access !== 'readproject'
      || captured.step.provider !== job.provider || captured.polishingId || Date.parse(job.startedAt) < Date.parse(build.createdAt)) return [];
    const profile = captured.verificationProfile;
    if (!profile?.enabled || !captured.step.nativeTools?.verification) return [];
    const bound = captured.inputArtifacts.some(candidate => {
      if (!attempt.inputs.includes(candidate.id) || !sourceIds.has(candidate.id)) return false;
      const canonical = artifacts.find(artifact => artifact.id === candidate.id);
      if (!canonical || canonical.contentHash !== candidate.contentHash) return false;
      try { return workflowArtifactCheck(candidate).contentHash === canonical.contentHash; } catch { return false; }
    });
    if (!bound) return [];
    const records = (job.verification ?? []).flatMap(raw => {
      let record: WorkflowVerificationRecord;
      try { record = workflowVerificationRecordCheck(raw); } catch { return []; }
      const command = profile.commands.find(command => command.id === record.commandId && captured.step.nativeTools?.verification?.commandIds.includes(command.id));
      if (!command || seen.has(record.id) || record.runId !== run.id || record.attemptId !== attempt.id || record.projectId !== run.projectId || record.workspaceId !== run.workspaceId
        || record.imageId !== profile.imageId || record.label !== command.label || record.executable !== command.executable || JSON.stringify(record.args) !== JSON.stringify(command.args)
        || Date.parse(record.startedAt) < Math.max(Date.parse(build.createdAt), Date.parse(attempt.startedAt), Date.parse(job.startedAt))) return [];
      seen.add(record.id); return [record];
    });
    return records.length ? [{ id: job.id, name: attempt.stepName, jobStatus: STATUS[job.status], records, currentHash: idea.increment?.verificationSourceHash }] : [];
  });
}
