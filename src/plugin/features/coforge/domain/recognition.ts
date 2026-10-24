import type { AppState, Contributor, Idea } from './types';

export type BadgeId = 'first-spark' | 'idea-maker' | 'community-favorite' | 'crowd-favorite' | 'backer' | 'co-creator' | 'world-builder';
export interface BadgeDefinition { id: BadgeId; title: string; description: string; threshold: number }
export interface BadgeProgress extends BadgeDefinition { current: number; earned: boolean; progress: number }
export interface CommunityProfile {
  contributor: Contributor; ideas: number; votesReceived: number; votesCast: number; implementations: number;
  ideasList: Idea[]; badges: BadgeProgress[]; earnedBadges: BadgeProgress[];
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'first-spark', title: 'First spark', description: 'Contribute 1 idea that passes screening.', threshold: 1 },
  { id: 'idea-maker', title: 'Idea maker', description: 'Contribute 5 ideas that pass screening.', threshold: 5 },
  { id: 'community-favorite', title: 'Community favorite', description: 'Receive 10 unique votes on one eligible idea.', threshold: 10 },
  { id: 'crowd-favorite', title: 'Crowd favorite', description: 'Receive 25 unique votes on one eligible idea.', threshold: 25 },
  { id: 'backer', title: 'Backer', description: 'Vote for 5 eligible ideas from other contributors.', threshold: 5 },
  { id: 'co-creator', title: 'Co-creator', description: 'Have 1 implementation accepted by the streamer.', threshold: 1 },
  { id: 'world-builder', title: 'World builder', description: 'Have 3 implementations accepted by the streamer.', threshold: 3 },
];

export function isRecognitionEligible(idea: Idea): boolean {
  return idea.status !== 'flagged' && idea.status !== 'rejected' && idea.status !== 'inbox' && idea.screening?.verdict === 'clear';
}

/** Recognition is a projection of current evidence, never a client-writable counter. */
export function buildCommunity(state: Pick<AppState, 'ideas' | 'contributors'>): CommunityProfile[] {
  const eligible = state.ideas.filter(isRecognitionEligible);
  return state.contributors.map(contributor => {
    const ideasList = eligible.filter(idea => idea.authorId === contributor.id);
    const ideas = ideasList.length;
    const votesReceived = ideasList.reduce((sum, idea) => sum + new Set(idea.voters).size, 0);
    const votesCast = eligible.filter(idea => idea.authorId !== contributor.id && idea.voters.includes(contributor.id)).length;
    const implementations = ideasList.filter(idea => idea.status === 'shipped').length;
    const maxVotes = Math.max(0, ...ideasList.map(idea => new Set(idea.voters).size));
    const metrics: Record<BadgeId, number> = {
      'first-spark': ideas, 'idea-maker': ideas, 'community-favorite': maxVotes, 'crowd-favorite': maxVotes,
      backer: votesCast, 'co-creator': implementations, 'world-builder': implementations,
    };
    const badges = BADGE_DEFINITIONS.map(badge => ({
      ...badge, current: metrics[badge.id], earned: metrics[badge.id] >= badge.threshold, progress: Math.min(1, metrics[badge.id] / badge.threshold),
    }));
    return { contributor, ideas, votesReceived, votesCast, implementations, ideasList, badges, earnedBadges: badges.filter(badge => badge.earned) };
  });
}
