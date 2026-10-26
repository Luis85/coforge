import type { Idea, IdeaStatus } from './types';

/**
 * Idea notes can be edited, synced or added outside CoForge. Everything a later stage relies on (the screened
 * text, status, scores, the plan the build agent receives and the streamer's feedback) is fingerprinted when
 * CoForge itself writes it. An idea past the inbox whose fingerprint no longer matches goes back to the inbox,
 * so changed text always passes screening again before any model sees it.
 */
export const VERIFIED_STATUSES: readonly IdeaStatus[] = ['screened', 'ranked', 'planned', 'building', 'review', 'shipped'];

/** cyrb53: a fast 53-bit string hash. It detects changes; it is not a signature. */
function hash(text: string): string {
  let h1 = 0xdeadbeef; let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761); h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function ideaFingerprint(idea: Pick<Idea, 'title' | 'description' | 'category' | 'status' | 'screening' | 'rice' | 'plan' | 'reviewNote' | 'projectId'>): string {
  return hash(JSON.stringify([
    idea.title, idea.description, idea.category, idea.status, idea.screening?.verdict ?? null,
    idea.rice ? [idea.rice.reach, idea.rice.impact, idea.rice.confidence, idea.rice.effort] : null,
    idea.plan ? [idea.plan.summary, idea.plan.steps, idea.plan.acceptanceCriteria, idea.plan.risks] : null,
    idea.reviewNote ?? null, ...(idea.projectId ? [idea.projectId] : []),
  ]));
}

export const needsVerification = (idea: Pick<Idea, 'status'>): boolean => VERIFIED_STATUSES.includes(idea.status);

/** Returns the idea to the inbox without its screening, score and plan. The text is kept; votes stay in plugin data. */
export function quarantine(idea: Idea): void {
  idea.status = 'inbox';
  delete idea.screening; delete idea.rice; delete idea.plan;
  idea.lastError = 'This idea was changed or added outside CoForge after screening. Screen it again before further agent work.';
  idea.updatedAt = new Date().toISOString();
}
