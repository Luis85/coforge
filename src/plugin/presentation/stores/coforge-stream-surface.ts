import { computed, ref } from "vue";
import type { StreamSurfaceSource } from "../../features/coforge/application/stream-surface-ports";
import type { StreamSurface } from "../../features/coforge/domain/stream-surfaces";
export function createStreamSurfaceStore(props: {
  surface: StreamSurface;
  source: StreamSurfaceSource;
}) {
  const state = ref(props.source.snapshot());
  const stop = props.source.subscribe((value) => {
    state.value = value;
  });

  return {
    state,
    metric: (value: number, unit: string) => {
      const singular: Record<string, string> = { votes: 'vote', ideas: 'idea', 'accepted builds': 'accepted build' };
      return `${value} ${value === 1 ? singular[unit] ?? unit : unit}`;
    },
    dispose: stop,
    title: computed(
      () =>
        ({
          kanban: "Community requests",
          chat: "Live chat",
          leaderboards: "Community leaderboards",
          community: "Our community",
        })[props.surface],
    ),
    boards: computed(() => [
      {
        name: "Most supported ideas",
        unit: "votes",
        entries: state.value.leaderboards.votes.map((entry) => ({
          name: entry.name,
          value: entry.votesReceived,
        })),
      },
      {
        name: "Idea makers",
        unit: "ideas",
        entries: state.value.leaderboards.ideas.map((entry) => ({
          name: entry.name,
          value: entry.ideas,
        })),
      },
      {
        name: "Co-creators",
        unit: "accepted builds",
        entries: state.value.leaderboards.implementations.map((entry) => ({
          name: entry.name,
          value: entry.implementations,
        })),
      },
    ]),
  };
}
