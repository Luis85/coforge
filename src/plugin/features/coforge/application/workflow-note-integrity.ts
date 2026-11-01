import { contextEventId } from '../domain/integrity';
import type { Idea } from '../domain/types';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => [key, ordered(item)]));
  return value;
}
export const workflowIntegrityKey = (idea: Pick<Idea, 'id'>): string => `workflow:${idea.id}`;
export const polishingIntegrityKey = (idea: Pick<Idea, 'id'>): string => `polishing:${idea.id}`;
export const polishingMetadataFingerprint = (idea: Pick<Idea, 'polishingRuns' | 'polishingAmendments'>): string => contextEventId(JSON.stringify(ordered([idea.polishingRuns ?? null, idea.polishingAmendments ?? null])));
export const workflowMetadataFingerprint = (idea: Pick<Idea, 'workflowRun' | 'workflowHistory' | 'polishingRuns' | 'polishingAmendments'>): string => {
  const legacy = [idea.workflowRun ?? null, idea.workflowHistory ?? null];
  return contextEventId(JSON.stringify(ordered(idea.polishingRuns || idea.polishingAmendments ? [...legacy, idea.polishingRuns ?? null, idea.polishingAmendments ?? null] : legacy)));
};

/** A canonical note may be edited; it cannot manufacture trusted execution progress. */
export function stopUntrustedWorkflow(idea: Idea): void {
  const message = 'Managed workflow progress changed outside CoForge. Its artifacts were preserved for inspection; start a fresh workflow instead of resuming this data.';
  idea.lastError = message;
  const now = new Date().toISOString();
  for (const run of [idea.workflowRun, ...(idea.polishingRuns ?? []).map(item => item.workflow)]) {
  if (!run) continue;
  for (const attempt of run.attempts) if (['queued', 'running', 'waiting-human'].includes(attempt.status)) {
    attempt.status = 'cancelled'; attempt.error = message; attempt.finishedAt = now;
  }
  run.state = 'stopped'; run.error = message; run.updatedAt = now;
  run.revision++;
  delete run.activeAttemptId;
  }
}
