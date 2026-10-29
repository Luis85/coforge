import { boolean, list, number, oneOf, optional, shape, text, timestamp } from './check';
import { automationContextCheck, type AutomationContext } from './automation-context';
import { contextEventId } from './integrity';
import { requestObjectIdentity } from './request-object';
import { WORKFLOW_OUTPUTS, workflowDefinitionCheck, workflowIdCheck, workflowStepCheck, type AiWorkflowStep, type WorkflowDefinition, type WorkflowOutput } from './configured-workflow';
import type { AppState, Idea, ImplementationPlan, Increment, RiceScore, Screening } from './types';
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
}
export interface WorkflowRun {
  automationEvent?: AutomationContext;
  external?: boolean;
  id: string; ideaId: string; projectId: string; definition: WorkflowDefinition; proposalRevision: string; revision: number; cursor: number;
  state: 'ready' | 'running' | 'waiting-human' | 'attention' | 'finished' | 'awaiting-review' | 'stopped';
  attempts: WorkflowAttempt[]; artifacts: WorkflowArtifact[]; workspaceId?: string; activeAttemptId?: string;
  createdAt: string; updatedAt: string; error?: string; invalidatedArtifactIds?: string[];
  projectContext?: { name: string; brief: string; agentPrompt: string; projectPath: string; worktreeFolder: string };
}
export interface ConfiguredStepExecution {
  automationEvent?: AutomationContext;
  runId: string; definitionRevision: string; proposalRevision: string; attemptId: string;
  step: AiWorkflowStep; inputArtifacts: WorkflowArtifact[]; workspaceId?: string;
}
const string = text({ max: 4096 });
const stringList = list(text({ max: 2000 }), { max: 100 });
const screening = shape({ verdict: oneOf(['clear', 'flagged'] as const), reason: text({ min: 1, max: 3000 }), signals: list(text({ max: 500 }), { max: 20 }),
  checkedAt: timestamp, provider: oneOf(['demo', 'claude', 'herdr', 'mcp'] as const) }, { strict: true });
const rice = shape({ reach: number({ integer: true, min: 1, max: 1000000 }), impact: oneOf([0.25, 0.5, 1, 2, 3] as const), confidence: number({ min: 0.05, max: 1 }),
  effort: number({ min: 0.25, max: 365 }), rationale: text({ min: 1, max: 6000 }), score: number({ min: 0, max: 1000000000000 }) }, { strict: true });
const plan = shape({ summary: text({ min: 1, max: 4000 }), steps: list(text({ min: 1, max: 2000 }), { min: 1, max: 24 }),
  acceptanceCriteria: list(text({ min: 1, max: 2000 }), { min: 1, max: 20 }), risks: list(text({ min: 1, max: 2000 }), { max: 16 }), markdown: text({ max: 100000 }), createdAt: timestamp }, { strict: true });
export const workflowPlanCheck = plan;
const increment = shape({ summary: text({ min: 1, max: 6000 }), files: list(shape({ path: string, additions: number({ integer: true, min: 0 }), deletions: number({ integer: true, min: 0 }) }, { strict: true }), { max: 10000 }),
  tests: stringList, diff: text({ max: 200000 }), branch: optional(string), worktree: optional(string), commit: optional(string), createdAt: timestamp, simulated: boolean }, { strict: true });
const artifact = shape({ id: workflowIdCheck, runId: workflowIdCheck, stepId: workflowIdCheck, attemptId: workflowIdCheck, proposalRevision: workflowIdCheck,
  output: oneOf(WORKFLOW_OUTPUTS), createdAt: timestamp, contentHash: workflowIdCheck, markdown: optional(text({ min: 1, max: WORKFLOW_MARKDOWN_LIMIT })), screening: optional(screening), rice: optional(rice), plan: optional(plan),
  increment: optional(increment), summary: optional(text({ min: 1, max: 6000 })), hostSnapshot: optional(boolean) }, { strict: true });
export function workflowArtifactCheck(value: unknown): WorkflowArtifact {
  const checked = artifact(value);
  const payloads = ['markdown', 'screening', 'rice', 'plan', 'increment'] as const;
  const key = checked.output === 'codechange' ? 'increment' : checked.output;
  if (payloads.some(field => field !== key && checked[field] !== undefined) || (checked.output === 'codechange' ? !checked.summary : checked[key] === undefined))
    throw new Error('The workflow artifact does not match its declared output contract.');
  if ((checked.output !== 'codechange' && checked.summary !== undefined) || (checked.increment && !checked.increment.files.length)) throw new Error('Only real code changes can carry an implementation increment.');
  if (checked.hostSnapshot && checked.output !== 'codechange') throw new Error('Only a host code-change snapshot can project workspace state.');
  if (checked.contentHash !== workflowArtifactHash(checked)) throw new Error('The workflow artifact content changed.');
  return checked;
}
const attempt = shape({ id: workflowIdCheck, stepId: workflowIdCheck, stepName: text({ min: 1, max: 100 }), kind: oneOf(['ai', 'approval', 'checklist', 'nudge', 'council'] as const),
  councilSourceId: optional(workflowIdCheck),
  nudgeState: optional(oneOf(['reserved', 'submitted', 'unknown', 'cancelled'] as const)), nudgeRunId: optional(workflowIdCheck), nudgeSourcePath: optional(text({ max: 1000 })), nudgeAcknowledgedAt: optional(timestamp),
  status: oneOf(['queued', 'running', 'waiting-human', 'succeeded', 'failed', 'cancelled'] as const), inputs: list(workflowIdCheck, { max: 200 }), startedAt: timestamp,
  finishedAt: optional(timestamp), jobId: optional(workflowIdCheck), checkedIds: optional(list(workflowIdCheck, { max: 40 })), note: optional(text({ max: 3000 })), error: optional(text({ max: 4000 })) }, { strict: true });
const run = shape({ id: workflowIdCheck, ideaId: workflowIdCheck, projectId: workflowIdCheck, definition: workflowDefinitionCheck, proposalRevision: workflowIdCheck,
  automationEvent: optional(automationContextCheck),
  external: optional(boolean),
  revision: number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER }), cursor: number({ integer: true, min: 0, max: 40 }),
  state: oneOf(['ready', 'running', 'waiting-human', 'attention', 'finished', 'awaiting-review', 'stopped'] as const), attempts: list(attempt, { max: 100 }), artifacts: list(workflowArtifactCheck, { max: 200 }),
  workspaceId: optional(workflowIdCheck), activeAttemptId: optional(workflowIdCheck), createdAt: timestamp, updatedAt: timestamp, error: optional(text({ max: 4000 })), invalidatedArtifactIds: optional(list(workflowIdCheck, { max: 200 })),
  projectContext: optional(shape({ name: text({ max: 100 }), brief: text({ max: 8000 }), agentPrompt: text({ max: 8000 }), projectPath: string, worktreeFolder: string }, { strict: true })) }, { strict: true });
export function workflowRunCheck(value: unknown): WorkflowRun {
  if (workflowSerializedSize(value) > WORKFLOW_RUN_LIMIT_BYTES) throw new Error('This workflow run exceeds 2 MiB. Preserve/export its evidence and start a fresh run; nothing was truncated.');
  const checked = run(value);
  if (checked.cursor > checked.definition.steps.length || new Set(checked.attempts.map(item => item.id)).size !== checked.attempts.length ||
      new Set(checked.artifacts.map(item => item.id)).size !== checked.artifacts.length || checked.artifacts.some(item => item.runId !== checked.id || item.proposalRevision !== checked.proposalRevision) ||
      checked.attempts.some(item => !checked.definition.steps.some(step => step.id === item.stepId)) ||
      checked.artifacts.some(item => !checked.attempts.some(attempt => attempt.id === item.attemptId && attempt.stepId === item.stepId)) ||
      (checked.activeAttemptId !== undefined && !checked.attempts.some(item => item.id === checked.activeAttemptId))) throw new Error('The workflow run has inconsistent identities or progress.');
  return checked;
}
export function configuredStepExecutionCheck(value: unknown): ConfiguredStepExecution {
  const checked = shape({ runId: workflowIdCheck, definitionRevision: workflowIdCheck, proposalRevision: workflowIdCheck, attemptId: workflowIdCheck,
    automationEvent: optional(automationContextCheck),
    step: workflowStepCheck, inputArtifacts: list(workflowArtifactCheck, { max: 200 }), workspaceId: optional(workflowIdCheck) }, { strict: true })(value);
  if (checked.step.kind !== 'ai') throw new Error('Only an AI step can be dispatched to a provider.');
  if (checked.inputArtifacts.some(item => item.runId !== checked.runId || item.proposalRevision !== checked.proposalRevision)) throw new Error('The workflow inputs belong to a different run or proposal.');
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
  for (const idea of state.ideas) {
    const run = idea.workflowRun;
    if (!run || run.state !== 'running') continue;
    const attempt = run.attempts.find(item => item.id === run.activeAttemptId);
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
