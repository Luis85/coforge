import { boolean, list, number, oneOf, optional, shape, text, timestamp } from './check';
import { automationContextCheck, type AutomationContext } from './automation-context';
import { contextEventId } from './integrity';
import { requestObjectIdentity } from './request-object';
import { workflowCouncilBindingsCheck, type WorkflowCouncilBinding } from './workflow-council-binding';
import { workflowCoworkerBindingsCheck, workflowCoworkerProfileCheck, type WorkflowCoworkerBinding, type WorkflowCoworkerProfile } from './workflow-coworker-binding';
import { WORKFLOW_OUTPUTS, workflowDefinitionCheck, workflowIdCheck, workflowStepCheck, type AiWorkflowStep, type WorkflowDefinition, type WorkflowOutput } from './configured-workflow';
import type { AppState, Idea, ImplementationPlan, Increment, RiceScore, Screening } from './types';
import { workflowOutputTemplateCheck, workflowOutputTemplateListCheck, type WorkflowOutputTemplate } from './workflow-output-templates';
import { backgroundBuildRetryApprovalsCheck, type BackgroundBuildRetryApproval } from './background-build-retry';
import type { PolishingAmendment } from './polishing';
import { polishingAmendmentsCheck } from './polishing-reference-check';
export const WORKFLOW_RUN_LIMIT_BYTES = 2 * 1024 * 1024;
export const WORKFLOW_HISTORY_LIMIT_BYTES = 8 * 1024 * 1024;
export const WORKFLOW_MARKDOWN_LIMIT = 16000;
export const WORKFLOW_ATTEMPT_RESERVE_BYTES = 512 * 1024;
export function workflowSerializedSize(value: unknown): number {
  const serialized = JSON.stringify(value) ?? '';
  if (!/[^\u0020-\u007e]/u.test(serialized)) return serialized.length;
  let bytes = 0;
  for (const char of serialized) {
    const code = char.charCodeAt(0);
    bytes += char.length === 2 ? 4 : code < 128 ? 1 : code < 2048 ? 2 : 3;
  }
  return bytes;
}

export interface WorkflowArtifact {
  id: string; runId: string; stepId: string; attemptId: string; proposalRevision: string; output: WorkflowOutput; createdAt: string; contentHash: string;
  markdown?: string; screening?: Screening; rice?: RiceScore; plan?: ImplementationPlan; increment?: Increment; summary?: string;
  hostSnapshot?: boolean;
}
export interface WorkflowAttempt {
  id: string; stepId: string; stepName: string; kind: 'ai' | 'approval' | 'checklist' | 'nudge' | 'council';
  status: 'queued' | 'running' | 'waiting-human' | 'succeeded' | 'failed' | 'cancelled';
  inputs: string[]; startedAt: string; finishedAt?: string; jobId?: string; checkedIds?: string[]; note?: string; error?: string;
  nudgeState?: 'reserved' | 'submitted' | 'unknown' | 'cancelled'; nudgeRunId?: string; nudgeSourcePath?: string; nudgeAcknowledgedAt?: string;
  councilSourceId?: string;
  councilCancellation?: 'requested' | 'confirmed' | 'unknown';
}
export interface WorkflowRun {
  polishingResources?: Array<{ id: string; priorWorkspaceId?: string; priorAttemptCount: number; workspaceId: string; fromRunRevision: number }>;
  backgroundRetries?: BackgroundBuildRetryApproval[];
  coworkerBindings?: WorkflowCoworkerBinding[];
  outputTemplates?: WorkflowOutputTemplate[];
  automationEvent?: AutomationContext;
  external?: boolean;
  id: string; ideaId: string; projectId: string; definition: WorkflowDefinition; proposalRevision: string; revision: number; cursor: number;
  state: 'ready' | 'running' | 'waiting-human' | 'attention' | 'finished' | 'awaiting-review' | 'stopped';
  attempts: WorkflowAttempt[]; artifacts: WorkflowArtifact[]; workspaceId?: string; activeAttemptId?: string;
  councilBindings?: WorkflowCouncilBinding[];
  createdAt: string; updatedAt: string; error?: string; invalidatedArtifactIds?: string[];
  projectContext?: { name: string; brief: string; agentPrompt: string; projectPath: string; worktreeFolder: string };
}
export interface ConfiguredStepExecution {
  polishingId?: string; polishingSourceHash?: string; polishingFeedback?: string; polishingPayload?: string; approvedPolishingInputs?: PolishingAmendment[];
  continuationId?: string; sourceRunId?: string; sourceRunHash?: string;
  backgroundRetryId?: string;
  coworker?: WorkflowCoworkerProfile;
  outputTemplate?: WorkflowOutputTemplate;
  automationEvent?: AutomationContext;
  runId: string; definitionRevision: string; proposalRevision: string; attemptId: string;
  step: AiWorkflowStep; inputArtifacts: WorkflowArtifact[]; workspaceId?: string;
}
const string = text({ max: 4096 });
const stringList = list(text({ max: 2000 }), { max: 100 });
const screening = shape({ verdict: oneOf(['clear', 'flagged'] as const), reason: text({ min: 1, max: 3000 }), signals: list(text({ max: 500 }), { max: 20 }),
  checkedAt: timestamp, provider: oneOf(['demo', 'claude', 'herdr', 'codex', 'mcp'] as const) }, { strict: true });
const rice = shape({ reach: number({ integer: true, min: 1, max: 1000000 }), impact: oneOf([0.25, 0.5, 1, 2, 3] as const), confidence: number({ min: 0.05, max: 1 }),
  effort: number({ min: 0.25, max: 365 }), rationale: text({ min: 1, max: 6000 }), score: number({ min: 0, max: 1000000000000 }) }, { strict: true });
const plan = shape({ summary: text({ min: 1, max: 4000 }), steps: list(text({ min: 1, max: 2000 }), { min: 1, max: 24 }),
  acceptanceCriteria: list(text({ min: 1, max: 2000 }), { min: 1, max: 20 }), risks: list(text({ min: 1, max: 2000 }), { max: 16 }), markdown: text({ max: 100000 }), createdAt: timestamp }, { strict: true });
export const workflowPlanCheck = plan;
export const workflowScreeningCheck = screening;
export const workflowRiceCheck = rice;
const increment = shape({ summary: text({ min: 1, max: 6000 }), files: list(shape({ path: string, additions: number({ integer: true, min: 0 }), deletions: number({ integer: true, min: 0 }) }, { strict: true }), { max: 10000 }),
  snapshotHash: optional(text({ pattern: /^[a-f0-9]{64}$/u })),
  tests: stringList, diff: text({ max: 200000 }), branch: optional(string), worktree: optional(string), commit: optional(string), createdAt: timestamp, simulated: boolean }, { strict: true });
export const workflowIncrementCheck = increment;
const artifact = shape({ id: workflowIdCheck, runId: workflowIdCheck, stepId: workflowIdCheck, attemptId: workflowIdCheck, proposalRevision: workflowIdCheck,
  output: oneOf(WORKFLOW_OUTPUTS), createdAt: timestamp, contentHash: workflowIdCheck, markdown: optional(text({ min: 1, max: WORKFLOW_MARKDOWN_LIMIT })), screening: optional(screening), rice: optional(rice), plan: optional(plan),
  increment: optional(increment), summary: optional(text({ min: 1, max: 6000 })), hostSnapshot: optional(boolean) }, { strict: true });
export function workflowArtifactCheck(value: unknown): WorkflowArtifact {
  const checked = artifact(value);
  const payloads = ['markdown', 'screening', 'rice', 'plan', 'increment'] as const;
  const key = checked.output === 'codechange' ? 'increment' : checked.output === 'design' ? 'markdown' : checked.output;
  if (payloads.some(field => field !== key && checked[field] !== undefined) || (checked.output === 'codechange' ? !checked.summary : checked[key] === undefined))
    throw new Error('The workflow artifact does not match its declared output contract.');
  if (checked.output === 'design' && !checked.markdown?.trim()) throw new Error('The Design specification must contain Markdown text.');
  if ((checked.output !== 'codechange' && checked.summary !== undefined) || (checked.increment && !checked.increment.files.length)) throw new Error('Only real code changes can carry an implementation increment.');
  if (checked.hostSnapshot && checked.output !== 'codechange') throw new Error('Only a host code-change snapshot can project workspace state.');
  if (checked.contentHash !== workflowArtifactHash(checked)) throw new Error('The workflow artifact content changed.');
  return checked;
}
const attempt = shape({ id: workflowIdCheck, stepId: workflowIdCheck, stepName: text({ min: 1, max: 100 }), kind: oneOf(['ai', 'approval', 'checklist', 'nudge', 'council'] as const),
  councilSourceId: optional(workflowIdCheck),
  councilCancellation: optional(oneOf(['requested', 'confirmed', 'unknown'] as const)),
  nudgeState: optional(oneOf(['reserved', 'submitted', 'unknown', 'cancelled'] as const)), nudgeRunId: optional(workflowIdCheck), nudgeSourcePath: optional(text({ max: 1000 })), nudgeAcknowledgedAt: optional(timestamp),
  status: oneOf(['queued', 'running', 'waiting-human', 'succeeded', 'failed', 'cancelled'] as const), inputs: list(workflowIdCheck, { max: 200 }), startedAt: timestamp,
  finishedAt: optional(timestamp), jobId: optional(workflowIdCheck), checkedIds: optional(list(workflowIdCheck, { max: 40 })), note: optional(text({ max: 3000 })), error: optional(text({ max: 4000 })) }, { strict: true });
const run = shape({ id: workflowIdCheck, ideaId: workflowIdCheck, projectId: workflowIdCheck, definition: workflowDefinitionCheck, proposalRevision: workflowIdCheck,
  polishingResources: optional(list(shape({ id: workflowIdCheck, priorWorkspaceId: optional(workflowIdCheck), priorAttemptCount: number({ integer: true, min: 0, max: 100 }), workspaceId: workflowIdCheck, fromRunRevision: number({ integer: true, min: 0 }) }, { strict: true }), { max: 25 })),
  backgroundRetries: optional(backgroundBuildRetryApprovalsCheck),
  coworkerBindings: optional(workflowCoworkerBindingsCheck),
  councilBindings: optional(workflowCouncilBindingsCheck),
  outputTemplates: optional(workflowOutputTemplateListCheck),
  automationEvent: optional(automationContextCheck),
  external: optional(boolean),
  revision: number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER }), cursor: number({ integer: true, min: 0, max: 40 }),
  state: oneOf(['ready', 'running', 'waiting-human', 'attention', 'finished', 'awaiting-review', 'stopped'] as const), attempts: list(attempt, { max: 100 }), artifacts: list(workflowArtifactCheck, { max: 200 }),
  workspaceId: optional(workflowIdCheck), activeAttemptId: optional(workflowIdCheck), createdAt: timestamp, updatedAt: timestamp, error: optional(text({ max: 4000 })), invalidatedArtifactIds: optional(list(workflowIdCheck, { max: 200 })),
  projectContext: optional(shape({ name: text({ max: 100 }), brief: text({ max: 8000 }), agentPrompt: text({ max: 8000 }), projectPath: string, worktreeFolder: string }, { strict: true })) }, { strict: true });
export function workflowRunCheck(value: unknown): WorkflowRun {
  if (workflowSerializedSize(value) > WORKFLOW_RUN_LIMIT_BYTES) throw new Error('This workflow run exceeds 2 MiB. Preserve/export its evidence and start a fresh run; nothing was truncated.');
  const checked = run(value);
  const retries = checked.backgroundRetries ?? [];
  if (new Set(retries.map(item => item.id)).size !== retries.length || retries.some((retry, index) => {
    const target = checked.attempts[retry.priorAttemptCount];
    const original = checked.definition.steps.find(step => step.id === retry.stepId);
    const source = checked.attempts.slice(0, retry.priorAttemptCount).find(attempt => attempt.id === retry.sourceAttemptId);
    const previous = checked.attempts.slice(0, retry.priorAttemptCount).find(attempt => attempt.id === retry.previousAttemptId);
    return !target || target.id !== retry.attemptId || target.jobId !== retry.jobId || target.stepId !== retry.stepId ||
      original?.kind !== 'ai' || original.output !== 'codechange' || original.access !== 'editworktree' || !['claude', 'codex'].includes(original.provider) ||
      retry.proposalRevision !== checked.proposalRevision || retry.fromRunRevision >= checked.revision ||
      (index > 0 && retry.priorAttemptCount <= retries[index - 1]!.priorAttemptCount) ||
      (!!retry.sourceAttemptId !== !!retry.sourceJobId) || (retry.sourceAttemptId !== undefined && source?.jobId !== retry.sourceJobId) ||
      (!!retry.previousAttemptId !== !!retry.previousJobId) || (retry.previousAttemptId !== undefined && (previous?.jobId !== retry.previousJobId || previous?.stepId !== retry.stepId)) ||
      (retry.sourceKind === 'workspace' ? !retry.priorWorkspaceId : retry.priorWorkspaceId !== undefined);
  })) throw new Error('The background retry audit does not match its original run and new attempt.');
  const assigned = checked.definition.steps.filter(step => step.kind === 'ai' && step.coworkerId);
  if (assigned.length !== (checked.coworkerBindings?.length ?? 0) || assigned.some(step => step.kind !== 'ai' || checked.coworkerBindings?.filter(item => item.stepId === step.id && item.profile.id === step.coworkerId && item.profile.provider === step.provider && item.profile.model === step.model && item.profile.effort === step.effort).length !== 1)) throw new Error('The captured CoWorkers do not match this workflow definition.');
  if (new Set(checked.councilBindings?.map(item => item.stepId)).size !== (checked.councilBindings?.length ?? 0) || checked.councilBindings?.some(item => item.binding.projectId !== checked.projectId || !checked.definition.steps.some(step => step.id === item.stepId && step.kind === 'council' && step.councilId === item.binding.councilId))) throw new Error('The workflow Council captures do not match its definition.');
  const selectedTemplates = [...new Set(checked.definition.steps.flatMap(step => step.kind === 'ai' && step.outputTemplateId ? [step.outputTemplateId] : []))];
  if (selectedTemplates.length !== (checked.outputTemplates?.length ?? 0) || selectedTemplates.some(id => checked.outputTemplates?.filter(template => template.id === id && template.projectId === checked.projectId).length !== 1)) throw new Error('The captured output templates do not match this workflow project and definition.');
  if (checked.cursor > checked.definition.steps.length || new Set(checked.attempts.map(item => item.id)).size !== checked.attempts.length ||
      new Set(checked.artifacts.map(item => item.id)).size !== checked.artifacts.length || checked.artifacts.some(item => item.runId !== checked.id || item.proposalRevision !== checked.proposalRevision) ||
      checked.attempts.some(item => !checked.definition.steps.some(step => step.id === item.stepId)) ||
      checked.artifacts.some(item => !checked.attempts.some(attempt => attempt.id === item.attemptId && attempt.stepId === item.stepId)) ||
      (checked.activeAttemptId !== undefined && !checked.attempts.some(item => item.id === checked.activeAttemptId))) throw new Error('The workflow run has inconsistent identities or progress.');
  return checked;
}
export function configuredStepExecutionCheck(value: unknown): ConfiguredStepExecution {
  const checked = shape({ runId: workflowIdCheck, definitionRevision: workflowIdCheck, proposalRevision: workflowIdCheck, attemptId: workflowIdCheck,
    polishingId: optional(workflowIdCheck), polishingSourceHash: optional(workflowIdCheck),
    polishingFeedback: optional(text({ min: 1, max: 8000 })), polishingPayload: optional(text({ min: 1, max: 400000 })),
    approvedPolishingInputs: optional(polishingAmendmentsCheck),
    continuationId: optional(workflowIdCheck), sourceRunId: optional(workflowIdCheck), sourceRunHash: optional(workflowIdCheck),
    backgroundRetryId: optional(workflowIdCheck),
    coworker: optional(workflowCoworkerProfileCheck),
    outputTemplate: optional(workflowOutputTemplateCheck),
    automationEvent: optional(automationContextCheck),
    step: workflowStepCheck, inputArtifacts: list(workflowArtifactCheck, { max: 200 }), workspaceId: optional(workflowIdCheck) }, { strict: true })(value);
  if (checked.step.kind !== 'ai') throw new Error('Only an AI step can be dispatched to a provider.');
  if (checked.step.coworkerId !== checked.coworker?.id || checked.coworker && (checked.coworker.provider !== checked.step.provider || checked.coworker.model !== checked.step.model || checked.coworker.effort !== checked.step.effort)) throw new Error('The captured CoWorker does not match this AI step.');
  if (checked.step.outputTemplateId !== checked.outputTemplate?.id) throw new Error('The captured output template does not match this step.');
  if (!!checked.polishingId !== !!checked.polishingSourceHash) throw new Error('The polishing source provenance is incomplete.');
  if (checked.inputArtifacts.some(item => !checked.polishingId && item.runId !== checked.runId && !checked.approvedPolishingInputs?.some(ref => ref.polishingRunId === item.runId && ref.artifactId === item.id && ref.artifactHash === item.contentHash) || item.proposalRevision !== checked.proposalRevision)) throw new Error('The workflow inputs belong to a different run or proposal.');
  return { ...checked, step: checked.step };
}
export function workflowHistoryCheck(value: unknown): WorkflowRun[] {
  if (workflowSerializedSize(value) > WORKFLOW_HISTORY_LIMIT_BYTES) throw new Error('The workflow history exceeds 8 MiB. Preserve/export its evidence; nothing was truncated.');
  return list(workflowRunCheck, { max: 25 })(value);
}
/** Derived facts and lifecycle status are deliberately excluded from immutable proposal identity. */
export const workflowProposalRevision = (idea: Idea): string => contextEventId(JSON.stringify([idea.projectId ?? '', idea.title, idea.description, idea.category, idea.requestKind ?? 'feature', idea.contexts ?? [], ...(idea.requestObject ? [requestObjectIdentity(idea.requestObject)] : [])]));
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key, item]) => key !== 'contentHash' && item !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, ordered(item)]));
  return value;
}
/** Stable corruption fingerprint, not a signature or proof of trusted production. */
export const workflowArtifactHash = (value: Omit<WorkflowArtifact, 'contentHash'> | WorkflowArtifact): string => contextEventId(JSON.stringify(ordered(value)));
export function recoverConfiguredRuns(state: Pick<AppState, 'ideas' | 'jobs'>): void {
  for (const idea of state.ideas) for (const run of [idea.workflowRun, ...(idea.polishingRuns ?? []).map(item => item.workflow)]) {
    for (const attempt of run?.attempts ?? []) if (attempt.councilCancellation === 'requested') { attempt.councilCancellation = 'unknown'; if (run) { run.error = 'CoForge closed before Council cancellation was confirmed. Inspect the original discussion and acknowledge recovery.'; run.revision++; run.updatedAt = new Date().toISOString(); } }
    if (!run || run.state !== 'running') continue;
    const attempt = run.attempts.find(item => item.id === run.activeAttemptId);
    if (attempt && state.jobs.some(job => job.durable && (['queued', 'running'].includes(job.status) || !job.durable.acknowledged) && job.workflow?.runId === run.id && job.workflow.attemptId === attempt.id)) continue;
    if (!attempt || !['ai', 'nudge', 'council'].includes(attempt.kind)) continue;
    if (attempt.kind === 'council' && attempt.nudgeState === 'submitted' && attempt.nudgeRunId) continue;
    run.state = 'attention';
    run.error = 'CoForge closed during this step. Inspect its original resources before an explicit retry.';
    run.updatedAt = new Date().toISOString();
    run.revision++;
    attempt.status = 'failed'; attempt.error = run.error; attempt.finishedAt = run.updatedAt;
    if (attempt.kind === 'nudge' || attempt.kind === 'council') { attempt.nudgeState = 'unknown'; run.error = 'CoForge closed during agent-task admission. Inspect the source/run and acknowledge recovery before a fresh nudge.'; attempt.error = run.error; }
    delete run.activeAttemptId;
  }
}
