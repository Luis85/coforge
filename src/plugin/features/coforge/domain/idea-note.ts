import { CheckError, list, noteTimestamp as timestamp, nullable, number, oneOf, optional, record, shape, text } from './check';
import { cleanLine, cleanText, escapeMarkdown, unescapeMarkdown } from './sanitize';
import type { Idea } from './types';
import { CATEGORIES, IDEA_STATUSES, planMarkdown } from './types';

/**
 * An idea note is canonical for the idea itself: identity, text, category, status and the saved
 * screening, RICE and plan evidence. Votes, increments and run history live in plugin data.
 * CoForge writes only the properties below and never rewrites the note body after creation.
 */
export const IDEA_MARKER = 'coforge-idea';
export const OWNED_PROPERTIES = [
  'type', 'id', 'title', 'category', 'status', 'author', 'author-name', 'votes', 'created', 'updated',
  'screening', 'screening-reason', 'screening-signals', 'screening-checked', 'screening-provider',
  'rice-reach', 'rice-impact', 'rice-confidence', 'rice-effort', 'rice-score', 'rice-rationale',
  'plan-summary', 'plan-steps', 'plan-acceptance', 'plan-risks', 'plan-created', 'review-note', 'last-error',
] as const;
type Owned = (typeof OWNED_PROPERTIES)[number];

export function ideaProperties(idea: Idea, authorName: string): Partial<Record<Owned, unknown>> {
  const p: Partial<Record<Owned, unknown>> = {
    type: IDEA_MARKER, id: idea.id, title: idea.title, category: idea.category, status: idea.status,
    author: idea.authorId, 'author-name': authorName, votes: idea.voters.length, created: idea.createdAt, updated: idea.updatedAt,
  };
  if (idea.screening) Object.assign(p, {
    screening: idea.screening.verdict, 'screening-reason': idea.screening.reason, 'screening-signals': idea.screening.signals,
    'screening-checked': idea.screening.checkedAt, 'screening-provider': idea.screening.provider,
  });
  if (idea.rice) Object.assign(p, {
    'rice-reach': idea.rice.reach, 'rice-impact': idea.rice.impact, 'rice-confidence': idea.rice.confidence,
    'rice-effort': idea.rice.effort, 'rice-score': idea.rice.score, 'rice-rationale': idea.rice.rationale,
  });
  if (idea.plan) Object.assign(p, {
    'plan-summary': idea.plan.summary, 'plan-steps': idea.plan.steps, 'plan-acceptance': idea.plan.acceptanceCriteria,
    'plan-risks': idea.plan.risks, 'plan-created': idea.plan.createdAt,
  });
  if (idea.reviewNote) p['review-note'] = idea.reviewNote;
  if (idea.lastError) p['last-error'] = idea.lastError;
  return p;
}

/** Applies the idea to existing frontmatter in place: unrelated properties are preserved, stale owned ones removed. */
export function applyIdeaProperties(frontmatter: Record<string, unknown>, idea: Idea, authorName: string): void {
  const next = ideaProperties(idea, authorName);
  for (const key of OWNED_PROPERTIES) {
    if (key in next) frontmatter[key] = next[key];
    else delete frontmatter[key];
  }
}

export function ideaBody(idea: Pick<Idea, 'title' | 'description'>): string {
  // Community text is escaped so Obsidian shows it literally (no embeds, remote images, HTML or inline queries).
  return `# ${escapeMarkdown(cleanLine(idea.title))}\n\n${escapeMarkdown(cleanText(idea.description))}\n\n## Notes\n\n`;
}

/** The description is the text between the first heading and the next heading. CoForge only reads it. */
export function descriptionFromBody(body: string, fallback: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => /^#\s/.test(line));
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(line => /^#{1,6}\s/.test(line));
  const description = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return cleanText(unescapeMarkdown(description), 3000) || fallback;
}

export function ideaFileName(idea: Pick<Idea, 'id' | 'title'>): string {
  const safe = cleanLine(idea.title).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).replace(/[. ]+$/, '');
  return `${idea.id} ${safe || 'Idea'}.md`;
}

const str = text();
const provider = oneOf(['demo', 'claude'] as const);
const noteShape = shape({
  type: oneOf([IDEA_MARKER] as const), id: text({ pattern: /^CF-\d{3,7}$/ }), title: text({ trim: true, min: 1, max: 200 }),
  category: oneOf(CATEGORIES), status: oneOf(IDEA_STATUSES), author: text({ min: 1 }), created: timestamp, updated: timestamp,
  screening: optional(oneOf(['clear', 'flagged'] as const)), 'screening-reason': optional(str), 'screening-signals': optional(nullable(list(str))),
  'screening-checked': optional(timestamp), 'screening-provider': optional(provider),
  'rice-reach': optional(number({ min: 0 })), 'rice-impact': optional(number({ gt: 0, max: 3 })), 'rice-confidence': optional(number({ min: 0, max: 1 })),
  'rice-effort': optional(number({ gt: 0 })), 'rice-score': optional(number({ min: 0 })), 'rice-rationale': optional(str),
  'plan-summary': optional(str), 'plan-steps': optional(nullable(list(str))), 'plan-acceptance': optional(nullable(list(str))),
  'plan-risks': optional(nullable(list(str))), 'plan-created': optional(timestamp),
  'review-note': optional(nullable(str)), 'last-error': optional(nullable(str)),
});

/** Reads an idea from its note. Voters and increments are joined from plugin data by the caller. */
export function parseIdeaNote(frontmatter: unknown, body: string): Omit<Idea, 'voters' | 'increment'> {
  const p = noteShape(record(frontmatter));
  const idea: Omit<Idea, 'voters' | 'increment'> = {
    id: p.id, number: Number(p.id.slice(3)), title: cleanLine(p.title, 200) || p.id, description: descriptionFromBody(body, cleanLine(p.title, 200) || p.id), authorId: p.author,
    category: p.category, status: p.status, createdAt: p.created, updatedAt: p.updated,
  };
  if (p.screening) idea.screening = {
    verdict: p.screening, reason: p['screening-reason'] ?? '', signals: p['screening-signals'] ?? [],
    checkedAt: p['screening-checked'] ?? p.updated, provider: p['screening-provider'] ?? 'demo',
  };
  const { 'rice-reach': reach, 'rice-impact': impact, 'rice-confidence': confidence, 'rice-effort': effort } = p;
  if (reach !== undefined && impact !== undefined && confidence !== undefined && effort !== undefined)
    idea.rice = { reach, impact, confidence, effort, score: p['rice-score'] ?? 0, rationale: p['rice-rationale'] ?? '' };
  if (p['plan-summary'] !== undefined) {
    const plan = { summary: p['plan-summary'], steps: p['plan-steps'] ?? [], acceptanceCriteria: p['plan-acceptance'] ?? [], risks: p['plan-risks'] ?? [] };
    idea.plan = { ...plan, createdAt: p['plan-created'] ?? p.updated, markdown: planMarkdown(plan, p.title) };
  }
  if (p['review-note']) idea.reviewNote = p['review-note'];
  if (p['last-error']) idea.lastError = p['last-error'];
  return idea;
}

export const isIdeaFrontmatter = (value: unknown): boolean => {
  try { return record(value).type === IDEA_MARKER; } catch (error) { if (error instanceof CheckError) return false; throw error; }
};
