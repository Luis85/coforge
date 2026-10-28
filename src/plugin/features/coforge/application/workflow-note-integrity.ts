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
export const workflowMetadataFingerprint = (idea: Pick<Idea, 'workflowRun' | 'workflowHistory'>): string =>
  contextEventId(JSON.stringify(ordered([idea.workflowRun ?? null, idea.workflowHistory ?? null])));

/** A canonical note may be edited; it cannot manufacture trusted execution progress. */
export function stopUntrustedWorkflow(idea: Idea): void {
  const message = 'Managed workflow progress changed outside CoForge. Its artifacts were preserved for inspection; start a fresh workflow instead of resuming this data.';
  idea.lastError = message;
  const run = idea.workflowRun;
  if (!run) return;
  const now = new Date().toISOString();
  for (const attempt of run.attempts) if (['queued', 'running', 'waiting-human'].includes(attempt.status)) {
    attempt.status = 'cancelled'; attempt.error = message; attempt.finishedAt = now;
  }
  run.state = 'stopped'; run.error = message; run.updatedAt = now;
  run.revision++;
  delete run.activeAttemptId;
}
