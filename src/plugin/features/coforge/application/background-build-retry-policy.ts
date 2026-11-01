import { workflowDefinition } from '../domain/configured-workflow';
import { workflowProposalRevision, WORKFLOW_ATTEMPT_RESERVE_BYTES, WORKFLOW_RUN_LIMIT_BYTES, workflowSerializedSize } from '../domain/configured-workflow-run';
import { durableBuildPolicyCheck, durableBuildTerminal } from '../domain/durable-build';
import { findProject, ideaProjectId } from '../domain/projects';
import { isActiveJob } from '../domain/workflow';
import { backgroundBuildRetrySourceCheck, type BackgroundBuildRetryPolicySource } from '../domain/background-build-retry';
import { configuredIdea, configuredInputs, configuredRuntime } from './configured-workflow-policy';
import { uncertainTaskAttempt } from './agent-task';
import type { InternalState } from './ports';
import { workflowSourceExecutors } from './workflow-source-executors';
import { assertVerificationSettled } from './verification-admission';

export function backgroundBuildRetryContext(state: InternalState, ideaId: string, executorBusy = false) {
  assertVerificationSettled(state, ideaId);
  const idea = configuredIdea(state, ideaId); const run = idea.workflowRun;
  if (!run) throw new Error('Restore the original managed workflow before retrying its Build.');
  const stopHold = state.workflowStopHolds?.includes(ideaId) ?? false;
  if (run.external) throw new Error('An external MCP execution cannot become a native background Build.');
  if (!['ready', 'attention', 'stopped'].includes(run.state) && !(stopHold && run.state === 'awaiting-review')) throw new Error('Finish or stop the original execution before retrying its Build.');
  if (executorBusy || state.jobs.some(job => job.ideaId === ideaId && (isActiveJob(job) || job.durable && !job.durable.acknowledged)) || run.attempts.some(uncertainTaskAttempt)) throw new Error('Inspect and settle the original executor before retrying; it may still own a writer.');
  if (run.proposalRevision !== workflowProposalRevision(idea) || run.projectId !== ideaProjectId(idea)) throw new Error('The proposal changed. Restore the original request revision before retrying this run.');
  const step = run.definition.steps[run.cursor];
  if (step?.kind !== 'ai' || step.output !== 'codechange' || step.access !== 'editworktree' || !['claude', 'codex'].includes(step.provider)) throw new Error('Only the current native Claude or Codex Build can be retried in background.');
  if (run.definition.steps.slice(run.cursor + 1).some(later => later.kind === 'ai' && later.access === 'editworktree' && !later.execution)) throw new Error('A later foreground editing step cannot adopt the background workspace. Use a compatible workflow for this run.');
  if (run.attempts.length >= 100 || workflowSerializedSize(run) > WORKFLOW_RUN_LIMIT_BYTES - WORKFLOW_ATTEMPT_RESERVE_BYTES) throw new Error('This run has no evidence capacity for another attempt. Preserve its history before continuing.');
  const project = findProject(state, run.projectId);
  if (!run.projectContext?.projectPath || run.projectContext.projectPath !== project.projectPath || run.projectContext.worktreeFolder !== project.worktreeFolder) throw new Error('Restore this run’s captured project directory before inspecting its original files.');
  configuredRuntime(state, idea, step); configuredInputs(run, step, idea.workflowHistory, idea);
  const previous = [...run.attempts].reverse().find(attempt => attempt.stepId === step.id);
  if (previous && !['failed', 'cancelled'].includes(previous.status)) throw new Error('The original Build attempt is not settled for a retry.');
  const job = previous && state.jobs.find(item => item.id === previous.jobId);
  if (previous && (!job || job.workflow?.runId !== run.id || job.workflow.attemptId !== previous.id || !['failed', 'cancelled'].includes(job.status))) throw new Error('Restore the original Build job and attempt metadata before retrying.');
  if (job?.durable && (!job.durable.acknowledged || !job.durable.snapshot || !durableBuildTerminal(job.durable.snapshot.phase))) throw new Error('Verify and recover the original worker before retrying.');
  const realChanges = !!idea.increment && !idea.increment.simulated && !!idea.increment.files.length || run.artifacts.some(artifact => artifact.increment && !artifact.increment.simulated && artifact.increment.files.length);
  const retainedWorkspace = state.jobs.some(item => item.workflow?.runId === run.id && item.workflow.workspaceId);
  if (!run.workspaceId && (realChanges || retainedWorkspace)) throw new Error('Restore the attributed original workspace; real earlier changes cannot be replaced by a clean repository.');
  const latestApproval = run.backgroundRetries?.at(-1);
  const pendingEpoch = latestApproval && latestApproval.attemptId === previous?.id && run.workspaceId === latestApproval.priorWorkspaceId && !job?.workflow?.workspaceId;
  const workspaceOwner = run.workspaceId ? [...state.jobs].reverse().find(item => item.workflow?.runId === run.id && item.workflow.workspaceId === run.workspaceId) : undefined;
  const sourceAttemptId = pendingEpoch ? latestApproval.sourceAttemptId : workspaceOwner?.workflow?.attemptId ?? previous?.id;
  const sourceJobId = pendingEpoch ? latestApproval.sourceJobId : workspaceOwner?.id ?? job?.id;
  const materialization = [...(run.polishingResources ?? [])].reverse().find(item => item.workspaceId === run.workspaceId);
  if (run.workspaceId && !materialization && (!sourceJobId || !sourceAttemptId || !run.attempts.some(attempt => attempt.id === sourceAttemptId && attempt.jobId === sourceJobId))) throw new Error('Restore the original workspace owner job and attempt before inspecting its files.');
  const source = backgroundBuildRetrySourceCheck({ projectId: run.projectId, ideaId, runId: run.id, runRevision: run.revision, proposalRevision: run.proposalRevision, stepId: step.id,
    ...(run.workspaceId ? { executorCandidates: workflowSourceExecutors(state, run.id, run.workspaceId) } : {}),
    ...(previous && job ? { executorAttemptId: previous.id, executorJobId: job.id } : {}),
    projectPath: run.projectContext.projectPath, sourceKind: run.workspaceId ? 'workspace' : 'repository', ...(run.workspaceId ? { sourceWorkspaceId: run.workspaceId } : {}),
    ...(materialization ? { sourceMaterializationId: materialization.id } : run.workspaceId && sourceAttemptId && sourceJobId ? { sourceAttemptId, sourceJobId } : {}), ...(idea.increment && !idea.increment.simulated ? { expectedIncrement: idea.increment } : {}) });
  const saved = workflowDefinition(project.settings); const matching = saved.steps.find(item => item.id === step.id && item.kind === 'ai' && item.output === step.output && item.access === step.access);
  const savedPolicy = matching?.kind === 'ai' ? matching.execution : undefined;
  const policy = durableBuildPolicyCheck({ ...(savedPolicy ?? { mode: 'background' }), idleWarningSeconds: savedPolicy?.idleWarningSeconds ?? 1800 });
  const policySource: BackgroundBuildRetryPolicySource = { kind: savedPolicy ? 'saved' : 'default', definitionRevision: saved.revision };
  const inheritedLimits = { maxTurns: run.definition.limits.maxTurns, maxBudgetUsd: run.definition.limits.maxBudgetUsd };
  const effectiveLimits = { maxTurns: policy.maxTurns ?? inheritedLimits.maxTurns, maxBudgetUsd: policy.maxBudgetUsd ?? inheritedLimits.maxBudgetUsd };
  const coworker = run.coworkerBindings?.find(binding => binding.stepId === step.id)?.profile;
  const identity = JSON.stringify({ source, step, policy, policySource, stopHold, inputs: configuredInputs(run, step, idea.workflowHistory, idea), coworker, permissions: project.allowImplementation });
  return { idea, run, step, source, policy, policySource, stopHold, coworker, inheritedLimits, effectiveLimits, identity, previousAttemptId: previous?.id, previousJobId: job?.id };
}
