import { computed, reactive, ref } from 'vue';
import { STATUS_LABELS } from '../../../features/coforge/domain/types';
import { buildCommunity, type BadgeId, type BadgeProgress, type CommunityProfile } from '../../../features/coforge/domain/recognition';
import { useStudioStore } from '../../stores/coforge-studio';
import { useStudioActions } from './use-studio-actions';
import { avatarStyle, initials } from './format';

type Metric = 'votesReceived' | 'ideas' | 'implementations';
const METRICS: ReadonlyArray<{ id: Metric; label: string; icon: string; unit: string }> = [
  { id: 'votesReceived', label: 'Most votes', icon: 'arrow-up', unit: 'votes received' },
  { id: 'ideas', label: 'Most ideas', icon: 'lightbulb', unit: 'screened ideas' },
  { id: 'implementations', label: 'Most implementations', icon: 'check-check', unit: 'accepted ideas' },
];
const BADGE_ICONS: Record<BadgeId, string> = {
  'first-spark': 'sparkles', 'idea-maker': 'lightbulb', 'community-favorite': 'heart', 'crowd-favorite': 'flame',
  backer: 'heart-handshake', 'co-creator': 'check-check', 'world-builder': 'mountain',
};
const LEADERBOARD_PREVIEW = 10;

const badgeView = (badge: BadgeProgress) => ({
  ...badge, icon: BADGE_ICONS[badge.id], hint: `${badge.title}: ${badge.description}`,
  progressText: `${Math.min(badge.current, badge.threshold)} / ${badge.threshold}`,
  progressLabel: `${badge.title}: ${badge.current} of ${badge.threshold}`,
});
const person = (profile: CommunityProfile) => ({
  id: profile.contributor.id, name: profile.contributor.name,
  initials: initials(profile.contributor.name), style: avatarStyle(profile.contributor.color),
});

/** View model of the community page: leaderboards, a selected contributor's profile and badges, and accepted ideas. */
export function useCommunity() {
  const store = useStudioStore();
  const actions = useStudioActions();
  const metric = ref<Metric>('votesReceived');
  const showAll = ref(false);
  const selectedId = ref<string | null>(null);
  const profiles = computed(() => store.state ? buildCommunity(store.state) : []);
  const ranked = computed(() => profiles.value
    .filter(row => row.ideas > 0 || row.votesCast > 0)
    .sort((a, b) => b[metric.value] - a[metric.value] || b.implementations - a.implementations
      || b.votesReceived - a.votesReceived || a.contributor.name.localeCompare(b.contributor.name)));
  const selected = computed(() => profiles.value.find(row => row.contributor.id === selectedId.value) ?? ranked.value[0]);
  const accepted = computed(() => profiles.value.flatMap(row => row.ideasList).filter(idea => idea.status === 'shipped')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

  return reactive({
    metrics: computed(() => METRICS.map(option => ({ ...option, active: option.id === metric.value }))),
    unit: computed(() => METRICS.find(option => option.id === metric.value)?.unit ?? ''),
    stack: computed(() => ranked.value.slice(0, 5).map(person)),
    makers: computed(() => ranked.value.filter(row => row.ideas > 0).length),
    totalVotes: computed(() => ranked.value.reduce((sum, row) => sum + row.votesReceived, 0).toLocaleString()),
    acceptedCount: computed(() => accepted.value.length),
    modeLabel: 'All projects',
    leaders: computed(() => (showAll.value ? ranked.value : ranked.value.slice(0, LEADERBOARD_PREVIEW)).map((row, index) => ({
      ...person(row), leading: index === 0, rankClass: index < 3 ? `is-rank-${index + 1}` : '',
      rank: String(index + 1).padStart(2, '0'),
      selected: selected.value?.contributor.id === row.contributor.id,
      ideasText: `${row.ideas} ${row.ideas === 1 ? 'idea' : 'ideas'}`, acceptedText: `${row.implementations} accepted`,
      badges: row.earnedBadges.slice(-3).map(badgeView),
      score: row[metric.value].toLocaleString(), showVoteIcon: metric.value === 'votesReceived',
    }))),
    hasMore: computed(() => ranked.value.length > LEADERBOARD_PREVIEW),
    moreLabel: computed(() => showAll.value ? 'Show top 10' : `Show all ${ranked.value.length} contributors`),
    selected: computed(() => {
      const profile = selected.value;
      if (!profile) return null;
      const earned = profile.earnedBadges.length;
      return {
        ...person(profile), ideas: profile.ideas, votesCast: profile.votesCast, implementations: profile.implementations,
        earnedText: `${earned} ${earned === 1 ? 'badge' : 'badges'} earned`,
        collectionText: `${earned} of ${profile.badges.length} earned · recognition backed by project activity.`,
        badges: profile.badges.map(badgeView),
        ideasList: [...profile.ideasList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(idea => ({
          id: idea.id, title: idea.title, status: idea.status, statusLabel: STATUS_LABELS[idea.status], votes: `${idea.voters.length} votes`,
        })),
      };
    }),
    accepted: computed(() => accepted.value.slice(0, 3).map(idea => {
      const author = store.state?.contributors.find(item => item.id === idea.authorId);
      return {
        id: idea.id, title: idea.title, author: author?.name ?? 'Community member',
        authorInitials: author ? initials(author.name) : '?', authorStyle: avatarStyle(author?.color),
      };
    })),
    setMetric: (next: Metric) => { metric.value = next; },
    toggleShowAll: () => { showAll.value = !showAll.value; },
    selectContributor: (id: string) => { selectedId.value = id; },
    openIdea: (id: string) => { void actions.openIdea(id); },
    openChat: () => store.navigate('stream'),
  });
}
export type CommunityModel = ReturnType<typeof useCommunity>;
