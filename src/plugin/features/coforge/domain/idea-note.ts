import { CheckError, list, noteTimestamp as timestamp, nullable, number, oneOf, optional, record, shape, text } from './check';
import { cleanDeep, cleanLine, cleanText, defangProperty, escapeMarkdown, unescapeMarkdown } from './sanitize';
import type { Idea } from './types';
import { IDEA_STATUSES, planMarkdown } from './types';
import { categoryNameCheck } from './request-categories';
import { ideaContextsCheck, contextProperties } from './idea-context';
import { workflowHistoryCheck, workflowRunCheck } from './configured-workflow-run';
import { restoreWorkflowNoteData, workflowNoteData } from './workflow-note-data';
import { polishingRunsCheck, polishingAmendmentsCheck } from './polishing-run-check';

/**
 * An idea note is canonical for the idea itself: identity, text, category, status and the saved
 * screening, RICE and plan evidence. Votes, increments and run history live in plugin data.
 * CoForge writes only the properties below and never rewrites the note body after creation.
 */
export const IDEA_MARKER = 'coforge-idea';
export { OWNED_PROPERTIES } from './idea-owned-properties';
import { OWNED_PROPERTIES } from './idea-owned-properties';
import { requestObjectFromProperties, requestObjectNoteProperties, requestObjectPropertyKeys } from './request-object-note';
export function ideaProperties(idea: Idea, authorName: string): Record<string, unknown> {
  const p: Record<string, unknown> = {
    type: IDEA_MARKER, id: idea.id, title: idea.title, category: idea.category, status: idea.status,
    author: idea.authorId, 'author-name': authorName, votes: idea.voters.length, created: idea.createdAt, updated: idea.updatedAt,
  };
  if (idea.projectId) p['coforge-project'] = idea.projectId;
  if (idea.requestKind) p['coforge-kind'] = idea.requestKind;
  if (idea.contexts?.length) p.contexts = contextProperties(idea.contexts);
  if (idea.workflowRun) p['workflow-run'] = workflowNoteData(workflowRunCheck(idea.workflowRun));
  if (idea.workflowHistory) p['workflow-history'] = workflowNoteData(workflowHistoryCheck(idea.workflowHistory));
  if (idea.polishingRuns) p['polishing-runs'] = workflowNoteData(polishingRunsCheck(idea.polishingRuns));
  if (idea.polishingAmendments) p['polishing-amendments'] = workflowNoteData(polishingAmendmentsCheck(idea.polishingAmendments));
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
  // Titles, names and model output are untrusted text: defang links, Templater commands and inline queries.
  for (const [key, value] of Object.entries(p)) {
    if (typeof value === 'string') p[key] = defangProperty(value);
    else if (Array.isArray(value)) p[key] = value.map(item => typeof item === 'string' ? defangProperty(item) : item);
  }
  if (idea.requestObject) Object.assign(p, requestObjectNoteProperties(idea.requestObject));
  return p;
}

/** Applies the idea to existing frontmatter in place: unrelated properties are preserved, stale owned ones removed. */
export function applyIdeaProperties(frontmatter: Record<string, unknown>, idea: Idea, authorName: string): void {
  const next = ideaProperties(idea, authorName);
  for (const key of [...OWNED_PROPERTIES, ...requestObjectPropertyKeys(idea.requestObject)]) {
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

// Notes can be edited or added outside CoForge, so read-back values get the same bounds as model output.
const str = text({ max: 6000 });
const item = text({ max: 2000 });
const items = (max: number) => optional(nullable(list(item, { max })));
const provider = oneOf(['demo', 'claude', 'herdr', 'codex', 'mcp'] as const);
const noteShape = shape({
  contexts: optional(ideaContextsCheck),
  type: oneOf([IDEA_MARKER] as const), id: text({ pattern: /^CF-\d{3,7}$/ }), title: text({ trim: true, min: 1, max: 200 }),
  'coforge-project': optional(text({ min: 1, max: 80, pattern: /^CFP-\d{3,7}$/ })),
  'coforge-kind': optional(oneOf(['feature', 'bug'] as const)),
  category: categoryNameCheck, status: oneOf(IDEA_STATUSES), author: text({ min: 3, max: 120, pattern: /^[a-z]+:\S/ }), created: timestamp, updated: timestamp,
  screening: optional(oneOf(['clear', 'flagged'] as const)), 'screening-reason': optional(str), 'screening-signals': items(20),
  'screening-checked': optional(timestamp), 'screening-provider': optional(provider),
  'rice-reach': optional(number({ min: 0 })), 'rice-impact': optional(number({ gt: 0, max: 3 })), 'rice-confidence': optional(number({ min: 0, max: 1 })),
  'rice-effort': optional(number({ gt: 0 })), 'rice-score': optional(number({ min: 0 })), 'rice-rationale': optional(str),
  'plan-summary': optional(str), 'plan-steps': items(24), 'plan-acceptance': items(20),
  'plan-risks': items(16), 'plan-created': optional(timestamp),
  'review-note': optional(nullable(text({ max: 3000 }))), 'last-error': optional(nullable(str)),
});

/**
 * Reads an idea from its note. Voters and increments are joined from plugin data by the caller. Every string
 * is sanitized again (this also removes the joiners `defangProperty` inserted when writing).
 */
export function parseIdeaNote(frontmatter: unknown, body: string): Omit<Idea, 'voters' | 'increment'> {
  const properties = record(frontmatter);
  const p = cleanDeep(noteShape(properties));
  const idea: Omit<Idea, 'voters' | 'increment'> = {
    id: p.id, number: Number(p.id.slice(3)), title: cleanLine(p.title, 200) || p.id, description: descriptionFromBody(body, cleanLine(p.title, 200) || p.id), authorId: p.author,
    category: p.category, status: p.status, createdAt: p.created, updatedAt: p.updated,
  };
  const requestObject = requestObjectFromProperties(properties);
  if (requestObject) idea.requestObject = requestObject;
  if (requestObject?.categories && !requestObject.categories.includes(idea.category)) throw new Error('The category is outside this request’s captured category list.');
  if (p['coforge-project']) idea.projectId = p['coforge-project'];
  if (p['coforge-kind']) idea.requestKind = p['coforge-kind'];
  if (p.contexts?.length) idea.contexts = p.contexts;
  if (p.screening) idea.screening = {
    verdict: p.screening, reason: p['screening-reason'] ?? '', signals: p['screening-signals'] ?? [],
    checkedAt: p['screening-checked'] ?? p.updated, provider: p['screening-provider'] ?? 'demo',
  };
  const { 'rice-reach': reach, 'rice-impact': impact, 'rice-confidence': confidence, 'rice-effort': effort } = p;
  if (reach !== undefined && impact !== undefined && confidence !== undefined && effort !== undefined)
    idea.rice = { reach, impact, confidence, effort, score: p['rice-score'] ?? 0, rationale: p['rice-rationale'] ?? '' };
  if (p['plan-summary'] !== undefined) {
    const plan = { summary: p['plan-summary'], steps: p['plan-steps'] ?? [], acceptanceCriteria: p['plan-acceptance'] ?? [], risks: p['plan-risks'] ?? [] };
    idea.plan = { ...plan, createdAt: p['plan-created'] ?? p.updated, markdown: planMarkdown(plan, idea.title) };
  }
  if (p['review-note']) idea.reviewNote = p['review-note'];
  if (p['last-error']) idea.lastError = p['last-error'];
  if (properties['workflow-run'] !== undefined) idea.workflowRun = workflowRunCheck(restoreWorkflowNoteData(properties['workflow-run']));
  if (properties['workflow-history'] !== undefined) idea.workflowHistory = workflowHistoryCheck(restoreWorkflowNoteData(properties['workflow-history']));
  if (properties['polishing-runs'] !== undefined) idea.polishingRuns = polishingRunsCheck(restoreWorkflowNoteData(properties['polishing-runs']));
  if (properties['polishing-amendments'] !== undefined) idea.polishingAmendments = polishingAmendmentsCheck(restoreWorkflowNoteData(properties['polishing-amendments']));
  if (idea.polishingRuns?.some(run => run.workflow.ideaId !== idea.id || run.workflow.projectId !== (idea.projectId ?? 'CFP-001'))) throw new Error('The polishing history belongs to a different request or project.');
  if (idea.workflowRun && (idea.workflowRun.ideaId !== idea.id || idea.workflowRun.projectId !== (idea.projectId ?? 'CFP-001')))
    throw new Error('The managed workflow run belongs to a different request or project.');
  if (idea.workflowHistory?.some(run => run.ideaId !== idea.id)) throw new Error('The managed workflow history belongs to a different request.');
  return idea;
}

export const isIdeaFrontmatter = (value: unknown): boolean => {
  try { return record(value).type === IDEA_MARKER; } catch (error) { if (error instanceof CheckError) return false; throw error; }
};
