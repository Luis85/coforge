import { describe, expect, it } from 'vitest';
import { buildCommunity } from '../../../features/coforge/domain/recognition';
import type { Contributor, Idea } from '../../../features/coforge/domain/types';

const people: Contributor[] = ['alice', 'bob'].map(id => ({ id, name: id, color: 'purple', joinedAt: '2026-01-01T00:00:00Z' }));
const idea = (id: string, extra: Partial<Idea> = {}): Idea => ({
  id, number: 1, title: 'Fishing', description: 'Add fishing', authorId: 'alice', category: 'Gameplay', status: 'ranked', voters: ['bob'],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  screening: { verdict: 'clear', reason: 'Feature idea', signals: [], checkedAt: '2026-01-01T00:00:00Z', provider: 'demo' },
  ...extra,
});

describe('evidence-based community recognition', () => {
  it('does not reward inbox, flagged or archived ideas', () => {
    const [alice] = buildCommunity({ contributors: people, ideas: [idea('1', { status: 'inbox' }), idea('2', { status: 'flagged' }), idea('3', { status: 'rejected' })] });
    expect(alice?.ideas).toBe(0);
    expect(alice?.earnedBadges).toEqual([]);
  });
  it('credits an implementation only after manual acceptance, once per idea', () => {
    const [alice] = buildCommunity({ contributors: people, ideas: [idea('1', { status: 'review' }), idea('2', { status: 'shipped' })] });
    expect(alice?.implementations).toBe(1);
    expect(alice?.earnedBadges.map(b => b.id)).toContain('co-creator');
  });
  it('deduplicates votes and excludes self-votes from backer recognition', () => {
    const [alice, bob] = buildCommunity({ contributors: people, ideas: [idea('1', { voters: ['bob', 'bob', 'alice'] })] });
    expect(alice?.votesReceived).toBe(2);
    expect(alice?.votesCast).toBe(0);
    expect(bob?.votesCast).toBe(1);
  });
  it('unlocks badges at exact criteria and caps displayed progress', () => {
    const ideas = Array.from({ length: 5 }, (_, n) => idea(String(n), { status: n < 3 ? 'shipped' : 'ranked', voters: Array.from({ length: 30 }, (_, v) => `viewer-${v}`) }));
    const [profile] = buildCommunity({ contributors: people, ideas });
    expect(profile?.earnedBadges.map(b => b.id)).toEqual(['first-spark', 'idea-maker', 'community-favorite', 'crowd-favorite', 'co-creator', 'world-builder']);
    expect(profile?.badges.every(b => b.progress <= 1)).toBe(true);
  });
});
