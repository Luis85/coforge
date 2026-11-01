import type { AgentJob, Idea, RuntimeInfo } from '../../../features/coforge/domain/types';
import { durableBuildTerminal, sameDurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { polishingResultValue } from '../../../features/coforge/domain/polishing-target';
import type { CardState } from './use-board-card';

export interface PolishingCardState extends CardState {
  status: 'queued' | 'running' | 'stopping' | 'finalizing' | 'review' | 'attention' | 'stopped' | 'disconnected' | 'checking';
  description: string;
}
type Status = PolishingCardState['status'];
const LABELS: Record<Status, string> = { queued: 'Polishing queued', running: 'Polishing in progress', stopping: 'Polishing · Stopping',
  finalizing: 'Polishing · Finalizing', review: 'Polishing ready for review', attention: 'Polishing needs attention',
  stopped: 'Polishing stopped', disconnected: 'Polishing · Worker disconnected', checking: 'Polishing · Checking execution' };
function state(status: Status, description: string, spin = false): PolishingCardState {
  return { status, label: LABELS[status], description, spin, tone: status === 'attention' ? 'flagged' : ['review', 'stopped', 'disconnected', 'checking', 'stopping'].includes(status) ? 'review' : 'agent',
    icon: spin ? 'loader-circle' : status === 'attention' ? 'flag' : status === 'review' ? 'file-check' : 'circle-dot' };
}

/** Independent auxiliary state: no card movement, primary-run projection or provider dispatch. */
export function polishingCardState(idea: Idea, jobs: readonly AgentJob[], runtime?: Pick<RuntimeInfo, 'durableBuildSnapshots' | 'durableBuildErrors'>): PolishingCardState | null {
  const pass = [...(idea.polishingRuns ?? [])].reverse().find(item => item.review === 'pending');
  if (!pass) return null;
  const run = pass.workflow;
  const related = jobs.filter(job => job.ideaId === idea.id && job.workflow?.runId === run.id && job.workflow.polishingId === pass.id);
  const attempt = run.activeAttemptId ? run.attempts.find(item => item.id === run.activeAttemptId) : run.attempts.at(-1);
  const job = attempt ? related.find(item => item.id === attempt.jobId && item.workflow?.attemptId === attempt.id) : undefined;
  const durable = job?.durable;
  const hot = job && runtime?.durableBuildSnapshots?.[job.id];
  const matchingHot = hot && durable && sameDurableBuildRef(hot.ref, durable.ref) ? hot : undefined;
  const saved = durable?.snapshot;
  const matchingSaved = saved && durable && sameDurableBuildRef(saved.ref, durable.ref) ? saved : undefined;
  const snapshot = matchingHot && (!matchingSaved || matchingHot.sequence >= matchingSaved.sequence) ? matchingHot : matchingSaved;
  const phase = snapshot?.phase;
  if (run.state === 'attention' || job?.status === 'failed' || phase === 'failed' || phase === 'attention' || saved && !snapshot || run.activeAttemptId && !attempt)
    return state('attention', 'Open this request to inspect the polishing pass and its recovery options.');
  if (job && (runtime?.durableBuildErrors?.[job.id] || !matchingHot && durable?.reconcileError))
    return state('disconnected', 'Worker contact is unavailable. The saved state does not confirm that polishing stopped. Open the request to inspect it.');
  if ((durable?.intent === 'cancel' || snapshot?.cancellationRequested || durable && (run.state === 'stopped' || job?.status === 'cancelled')) && (!phase || !durableBuildTerminal(phase)))
    return state('stopping', 'Cancellation was requested. Open the request to check the original execution.');
  if (run.state === 'stopped' || job?.status === 'cancelled' || phase === 'cancelled')
    return state('stopped', 'The polishing pass stopped. Open this request to inspect or dismiss it.');
  if (run.state === 'finished' || run.state === 'awaiting-review') {
    try { polishingResultValue(pass); }
    catch { return state('attention', 'The completed polishing result needs inspection. Open this request to review its evidence.'); }
    if (related.some(item => ['queued', 'running'].includes(item.status) || item.durable && item.durable.acknowledged !== true))
      return state('finalizing', 'The result is retained while execution ownership settles. Open this request to inspect it.');
    return state('review', 'Open this request to review and Apply or Discard the polished result.');
  }
  if (phase === 'completed') return state('finalizing', 'The worker finished. CoForge is checking the retained result.');
  if (phase === 'finalizing') return state('finalizing', 'The background worker is capturing the polished result.', true);
  if (phase === 'starting' || phase === 'running') return state('running', 'The background worker is polishing the current result. The main workflow checkpoint is preserved.', true);
  if (job?.status === 'queued' || phase === 'prepared') return state('queued', 'The polishing pass is waiting for an execution lane.');
  if (job?.status === 'running' && (!durable || snapshot)) return state('running', 'An independent pass is polishing the current result. The main workflow checkpoint is preserved.', true);
  if (run.state === 'ready') return state('queued', 'The polishing pass is waiting to start.');
  if (run.state === 'running') return state('checking', 'The saved pass is in progress. Open this request to check its execution.');
  return state('attention', 'Open this request to inspect the polishing pass.');
}
