import type { Idea } from '../../../features/coforge/domain/types';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import type { DurableBuildPolicy } from '../../../features/coforge/domain/durable-build';
import { buildDuration } from './durable-build-display';

export function backgroundRetryCandidate(idea: Idea | undefined): boolean {
  const run = idea?.workflowRun;
  const step = run?.definition.steps[run.cursor];
  return Boolean(run && !run.external && !idea?.polishingRuns?.some(pass => pass.review === 'pending') && ['ready', 'attention', 'stopped', 'awaiting-review'].includes(run.state)
    && !['shipped', 'rejected', 'flagged'].includes(idea!.status)
    && step?.kind === 'ai' && step.output === 'codechange' && step.access === 'editworktree' && ['claude', 'codex'].includes(step.provider));
}
export function reviewedBackgroundRetryRequired(run: WorkflowRun | undefined): boolean {
  return Boolean(run?.backgroundRetries?.some(approval => approval.stepId === run.definition.steps[run.cursor]?.id));
}
export const retryDeadline = (policy: DurableBuildPolicy): string => policy.maxRuntimeSeconds === undefined ? 'No elapsed deadline' : `${buildDuration(policy.maxRuntimeSeconds)} elapsed deadline`;
export const retryIdleWarning = (policy: DurableBuildPolicy): string => policy.idleWarningSeconds === 0 ? 'Inactivity warning off' : `${buildDuration(policy.idleWarningSeconds ?? 1800)} inactivity warning · advisory only`;
