import { StudioError } from './errors';
import type { AgentJob, AgentStage, Idea, IdeaStatus, Settings } from './types';
import { rankedIdeas, STAGE_LABELS, STAGES } from './types';

const predecessors: Record<AgentStage, IdeaStatus> = { screen: 'inbox', score: 'screened', plan: 'ranked', implement: 'planned' };
const nextStage: Partial<Record<IdeaStatus, AgentStage>> = { inbox: 'screen', screened: 'score', ranked: 'plan', planned: 'implement' };

export const stageFor = (idea: Idea): AgentStage | null => nextStage[idea.status] ?? null;
export const isActiveJob = (job: AgentJob): boolean => job.status === 'queued' || job.status === 'running';

/** Rejects any stage whose evidence is missing. There is no general-purpose "set status" transition. */
export function assertStage(idea: Idea, stage: AgentStage): void {
  if (idea.status !== predecessors[stage])
    throw new StudioError(`${STAGE_LABELS[stage]} requires an idea in ${predecessors[stage]}; ${idea.id} is ${idea.status}.`, 409);
  if (stage !== 'screen' && idea.screening?.verdict !== 'clear') throw new StudioError('Complete screening or an explicit moderation review first.', 409);
  if ((stage === 'plan' || stage === 'implement') && !idea.rice) throw new StudioError('A RICE review is required before planning.', 409);
  if (stage === 'implement' && !idea.plan) throw new StudioError('A saved implementation plan is required before building.', 409);
}

function eligible(idea: Idea, stage: AgentStage): boolean {
  try { assertStage(idea, stage); return true; } catch { return false; }
}

/**
 * Automatic dispatch: enabled stages rotate after the most recently dispatched stage; within a stage the
 * highest-ranked eligible idea wins. Busy, failed/cancelled and manually held ideas are skipped.
 */
export function nextEligible(state: { ideas: Idea[]; jobs: AgentJob[]; settings: Settings; manualHolds: string[] }): { idea: Idea; stage: AgentStage } | null {
  const busy = new Set(state.jobs.filter(isActiveJob).map(job => job.ideaId));
  const candidates = rankedIdeas(state.ideas).filter(idea => !busy.has(idea.id) && !idea.lastError && !state.manualHolds.includes(idea.id));
  const last = state.jobs[state.jobs.length - 1]?.stage;
  const start = last ? (STAGES.indexOf(last) + 1) % STAGES.length : 0;
  const order = [...STAGES.slice(start), ...STAGES.slice(0, start)];
  for (const stage of order) {
    if (!state.settings.automation[stage]) continue;
    const idea = candidates.find(candidate => stageFor(candidate) === stage
      && !(stage === 'plan' && candidate.voters.length < state.settings.minVotes) && eligible(candidate, stage));
    if (idea) return { idea, stage };
  }
  return null;
}

const INJECTION_CHECKS: Array<[RegExp, string]> = [
  [/ignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts|rules)/i, 'Instruction override'],
  [/(?:reveal|show|print|dump)\s+(?:the\s+)?(?:system|developer)\s+prompt/i, 'System prompt disclosure'],
  [/(?:upload|send|exfiltrat\w*|reveal|dump).{0,90}(?:\.env|api[ _-]?key|password|token|credential|secret)/i, 'Secret exfiltration'],
  [/(?:\.env|api[ _-]?key|password|credential).{0,90}(?:upload|external server|webhook|exfiltrat)/i, 'Secret exfiltration'],
  [/(?:rm\s+-rf|format\s+c:|delete\s+(?:all\s+)?(?:system|project)\s+files)/i, 'Destructive command'],
  [/(?:bypass|disable)\s+(?:all\s+)?(?:security|safety|permissions|screening)/i, 'Permission bypass'],
];

/** Local injection heuristics applied on top of every screening provider. Not a security guarantee. */
export function heuristicSignals(text: string): string[] {
  return [...new Set(INJECTION_CHECKS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label))];
}
