import { list, optional, record, shape, text, timestamp, type Check } from './check';
import { workflowHistoryCheck, workflowRunCheck } from './configured-workflow-run';
import { incrementStateCheck } from './increment-state';
import { polishingRunsCheck, polishingAmendmentsCheck } from './polishing-run-check';
import type { Idea } from './types';
import { parseIdeaNote } from './idea-note';

/** Private retained evidence; the canonical authored note is moved to Obsidian trash. */
export interface DeletedRequest extends Pick<Idea, 'id' | 'title' | 'createdAt' | 'voters' | 'increment' | 'workflowRun' | 'workflowHistory' | 'polishingRuns' | 'polishingAmendments'> {
  projectId: string; projectName: string; deletedAt: string;
  proposal?: { properties: Record<string, unknown>; body: string };
}
const proposal: Check<NonNullable<DeletedRequest['proposal']>> = (value, path) => {
  const checked = shape({ properties: record, body: text({ max: 30000 }) }, { strict: true })(value, path);
  parseIdeaNote(checked.properties, checked.body); return checked;
};
const id = text({ pattern: /^CF-\d{3,7}$/u });
const projectId = text({ pattern: /^CFP-\d{3,7}$/u });
const deleted: Check<DeletedRequest> = shape({ id, title: text({ min: 1, max: 200 }), projectId, projectName: text(),
  proposal: optional(proposal),
  createdAt: timestamp, deletedAt: timestamp, voters: list(text()), increment: optional(incrementStateCheck),
  workflowRun: optional(workflowRunCheck), workflowHistory: optional(workflowHistoryCheck),
  polishingRuns: optional(polishingRunsCheck), polishingAmendments: optional(polishingAmendmentsCheck) }, { strict: true });
export const deletedRequestsCheck = list(deleted);
export interface RequestDeletionPreview { ideaId: string; projectId: string; title: string; stateKey: string; noteFingerprint: string }
export const requestDeletionPreviewCheck: Check<RequestDeletionPreview> = shape({ ideaId: id, projectId, title: text({ min: 1, max: 200 }),
  stateKey: text({ min: 1, max: 160 }), noteFingerprint: text({ min: 1, max: 160 }) }, { strict: true });
