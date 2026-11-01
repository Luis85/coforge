import type { Idea, IdeaStatus } from './types';
import { requestObjectIdentity } from './request-object';
import { cleanDeep } from './sanitize';

/**
 * Idea notes can be edited, synced or added outside CoForge. Everything a later stage relies on (the screened
 * text, status, scores, the plan the build agent receives and the streamer's feedback) is fingerprinted when
 * CoForge itself writes it. An idea past the inbox whose fingerprint no longer matches goes back to the inbox,
 * so changed text always passes screening again before any model sees it.
 */
export const VERIFIED_STATUSES: readonly IdeaStatus[] = ['screened', 'ranked', 'planned', 'building', 'review', 'shipped'];

import { hash } from './integrity-hash';
export { contextEventId } from './integrity-hash';

export function ideaFingerprint(idea: Pick<Idea, 'title' | 'description' | 'category' | 'status' | 'screening' | 'rice' | 'plan' | 'reviewNote' | 'projectId' | 'requestKind' | 'contexts' | 'requestObject'>): string {
  // Compare the same normalized managed input that parseIdeaNote reads; workflow/artifact anchors stay byte-sensitive.
  return hash(JSON.stringify(cleanDeep([
    idea.title, idea.description, idea.category, idea.status, idea.screening?.verdict ?? null,
    idea.rice ? [idea.rice.reach, idea.rice.impact, idea.rice.confidence, idea.rice.effort] : null,
    idea.plan ? [idea.plan.summary, idea.plan.steps, idea.plan.acceptanceCriteria, idea.plan.risks] : null,
    idea.reviewNote ?? null, ...(idea.projectId ? [idea.projectId] : []), ...(idea.requestKind === 'bug' ? ['bug'] : []),
    ...(idea.contexts?.length ? [idea.contexts] : []),
    ...(idea.requestObject ? [requestObjectIdentity(idea.requestObject)] : []),
  ])));
}

export const needsVerification = (idea: Pick<Idea, 'status'>): boolean => VERIFIED_STATUSES.includes(idea.status);

/** Returns the idea to the inbox without its screening, score and plan. The text is kept; votes stay in plugin data. */
export function quarantine(idea: Idea): void {
  idea.status = 'inbox';
  delete idea.screening; delete idea.rice; delete idea.plan;
  idea.lastError = 'This idea was changed or added outside CoForge after screening. Screen it again before further agent work.';
  idea.updatedAt = new Date().toISOString();
}
