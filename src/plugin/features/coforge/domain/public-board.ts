import { buildCommunity, type BadgeId } from './recognition';
import type { AppState, Category, ContributorColor, Idea, IdeaStatus } from './types';
import { rankedIdeas, STATUS_LABELS } from './types';
import { INITIAL_PROJECT_ID, projectIdeas } from './projects';

/**
 * The viewer-facing snapshot published to GitHub Pages. It is public by design and contains only
 * screened ideas, display names, scores, plans and recognition: no platform user IDs, chat log,
 * run logs, review notes, worktree paths, settings or flagged/archived/unscreened requests.
 */
export type PublicColumnId = 'inbox' | 'next' | 'progress' | 'done';
export interface PublicIdea {
  contexts?: Array<{ author: string; text: string }>;
  id: string; title: string; description: string; category: Category; status: string; column: PublicColumnId;
  votes: number; rice: number | null; author: string; plan: { summary: string; steps: string[] } | null;
}
export interface PublicColumn { id: PublicColumnId; title: string; hint: string; ideas: PublicIdea[] }
export interface PublicContributor {
  name: string; color: ContributorColor; ideas: number; votesReceived: number; implementations: number;
  badges: Array<{ id: BadgeId; title: string; description: string; earned: boolean; current: number; threshold: number }>;
}
export interface PublicBoard {
  format: 'coforge-public-board/v1'; generatedAt: string; project: string; projectId: string;
  columns: PublicColumn[]; awaitingScreening: number;
  leaderboards: { votes: PublicContributor[]; ideas: PublicContributor[]; implementations: PublicContributor[] };
  contributors: PublicContributor[];
}

const COLUMNS: Array<{ id: PublicColumnId; title: string; hint: string; statuses: IdeaStatus[] }> = [
  { id: 'inbox', title: 'Inbox', hint: 'Screened requests waiting for a score', statuses: ['screened'] },
  { id: 'next', title: 'Up next', hint: 'Ranked and planned', statuses: ['ranked', 'planned'] },
  { id: 'progress', title: 'In progress', hint: 'Being built or reviewed', statuses: ['building', 'review'] },
  { id: 'done', title: 'Accepted', hint: 'Accepted by the streamer', statuses: ['shipped'] },
];
const LEADERBOARD_SIZE = 10;

const isPublic = (idea: Idea) => idea.screening?.verdict === 'clear' && COLUMNS.some(column => column.statuses.includes(idea.status));

export function buildPublicBoard(state: Pick<AppState, 'ideas' | 'contributors' | 'settings' | 'activeProjectId'>, now = new Date()): PublicBoard {
  const names = new Map(state.contributors.map(person => [person.id, person.name]));
  const toPublic = (idea: Idea, column: PublicColumnId): PublicIdea => ({
    ...(idea.contexts?.length ? { contexts: idea.contexts.map(context => ({ author: context.authorName, text: context.text })) } : {}),
    id: idea.id, title: idea.title, description: idea.description, category: idea.category, status: STATUS_LABELS[idea.status], column,
    votes: new Set(idea.voters).size, rice: idea.rice?.score ?? null, author: names.get(idea.authorId) ?? 'Community member',
    plan: idea.plan ? { summary: idea.plan.summary, steps: [...idea.plan.steps] } : null,
  });
  const ideas = projectIdeas(state);
  const ranked = rankedIdeas(ideas.filter(isPublic));
  const columns = COLUMNS.map(({ statuses, ...column }) => ({
    ...column, ideas: ranked.filter(idea => statuses.includes(idea.status)).map(idea => toPublic(idea, column.id)),
  }));
  const contributors: PublicContributor[] = buildCommunity(state)
    .filter(profile => profile.ideas > 0 || profile.votesCast > 0)
    .map(profile => ({
      name: profile.contributor.name, color: profile.contributor.color, ideas: profile.ideas, votesReceived: profile.votesReceived,
      implementations: profile.implementations,
      badges: profile.badges.map(({ id, title, description, earned, current, threshold }) => ({ id, title, description, earned, current, threshold })),
    }));
  const top = (metric: (person: PublicContributor) => number) => contributors.filter(person => metric(person) > 0)
    .sort((a, b) => metric(b) - metric(a) || a.name.localeCompare(b.name)).slice(0, LEADERBOARD_SIZE);
  return {
    format: 'coforge-public-board/v1', generatedAt: now.toISOString(), project: state.settings.projectName, projectId: state.activeProjectId ?? INITIAL_PROJECT_ID, columns,
    awaitingScreening: ideas.filter(idea => idea.status === 'inbox').length,
    leaderboards: { votes: top(p => p.votesReceived), ideas: top(p => p.ideas), implementations: top(p => p.implementations) },
    contributors: contributors.filter(person => person.badges.some(badge => badge.earned)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Equality that ignores the generation time, so unchanged boards are not rewritten (no noisy commits). */
export const sameBoard = (a: PublicBoard, b: PublicBoard): boolean =>
  JSON.stringify({ ...a, generatedAt: '' }) === JSON.stringify({ ...b, generatedAt: '' });
