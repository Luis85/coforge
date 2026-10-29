import type { AppState } from "./types";
import {
  buildPublicBoard,
  type PublicContributor,
  type PublicIdea,
} from "./public-board";
import { createEmptyState } from "./seed";
import { projectIsPublic } from './project-publicity';
import { defaultEconomyRules, type EconomyRules } from "./population";
import {
  defaultCommunityEnvironment,
  type NamedRank,
} from "./community-environment";
export const STREAM_SURFACES = [
  {
    id: "kanban",
    title: "CoForge Stream - Kanban",
    label: "Stream Kanban",
    icon: "coforge-stream-kanban",
  },
  {
    id: "chat",
    title: "CoForge Stream - Chat",
    label: "Stream Chat",
    icon: "coforge-stream-chat",
  },
  {
    id: "leaderboards",
    title: "CoForge Stream - Leaderboards",
    label: "Stream Leaderboards",
    icon: "coforge-stream-leaderboards",
  },
  {
    id: "community",
    title: "CoForge Stream - Community",
    label: "Stream Community",
    icon: "coforge-stream-community",
  },
] as const;
export type StreamSurface = (typeof STREAM_SURFACES)[number]["id"];
export type StreamIdea = Pick<
  PublicIdea,
  | "id"
  | "title"
  | "description"
  | "category"
  | "status"
  | "votes"
  | "author"
  | "rice"
> & { contexts: Array<{ author: string; text: string }> };
export interface StreamSurfaceSnapshot {
  board: {
    project: string;
    projectId: string;
    awaitingScreening: number;
    screenedRequests: number;
    columns: Array<{
      id: string;
      title: string;
      count: number;
      ideas: StreamIdea[];
    }>;
  };
  chat: {
    connected: boolean;
    messages: Array<{ key: string; name: string; text: string; at: string }>;
  };
  leaderboards: {
    votes: PublicContributor[];
    ideas: PublicContributor[];
    implementations: PublicContributor[];
  };
  community: {
    actorName: string;
    currencyName: string;
    contributors: PublicContributor[];
    ranks: NamedRank[];
    rules: EconomyRules;
  };
}
/** Whitelist, never a stripped clone of AppState. No runtime/accounts/paths/prompts/review/CRM/cost fields cross this seam. */
export function streamSurfaceSnapshot(
  state: AppState,
  context: { channelId: string; liveSince: number; projectId?: string },
): StreamSurfaceSnapshot {
  const project =
    context.projectId === undefined
      ? undefined
      : state.projects?.find(
          (project) => project.id === context.projectId && projectIsPublic(state, project.id),
        );
  const scoped =
    context.projectId === undefined
      ? state
      : project
        ? { ...state, activeProjectId: project.id, settings: project.settings }
        : {
            ...state,
            activeProjectId: "unavailable",
            settings: {
              ...state.settings,
              projectName: "Choose a project in CoForge",
            },
          };
  const board = buildPublicBoard(scoped);
  const connected = state.runtime.twitch?.phase === "connected";
  const rules = state.population?.rules ?? defaultEconomyRules();
  return {
    board: {
      project: board.project,
      projectId:
        context.projectId !== undefined && !project ? "" : board.projectId,
      awaitingScreening: board.awaitingScreening,
      screenedRequests: board.columns.reduce(
        (sum, column) => sum + column.ideas.length,
        0,
      ),
      columns: board.columns.map((column) => ({
        id: column.id,
        title: column.title,
        count: column.ideas.length,
        ideas: column.ideas
          .slice(0, 50)
          .map(
            ({
              id,
              title,
              description,
              category,
              status,
              votes,
              author,
              rice,
            }) => ({
              id,
              title,
              description,
              category,
              status,
              votes,
              author,
              rice,
              contexts:
                state.ideas
                  .find((idea) => idea.id === id)
                  ?.contexts?.map((entry) => ({
                    author: entry.authorName,
                    text: entry.text,
                  })) ?? [],
            }),
          ),
      })),
    },
    chat: {
      connected,
      messages: !connected
        ? []
        : state.chat
            .filter(
              (message) =>
                message.source === "twitch" &&
                message.twitchChannelId === context.channelId &&
                message.userId !== "system:coforge" &&
                Date.parse(message.createdAt) >= context.liveSince,
            )
            .slice(-80)
            .map((message, index) => ({
              key: `chat-${index}`,
              name: message.username,
              text: message.text,
              at: message.createdAt,
            })),
    },
    leaderboards: board.leaderboards,
    community: {
      actorName:
        state.population?.environment.actorName ??
        defaultCommunityEnvironment().actorName,
      currencyName:
        state.population?.environment.currencyName ??
        defaultCommunityEnvironment().currencyName,
      contributors: board.contributors,
      ranks: (
        state.population?.environment.ranks ??
        defaultCommunityEnvironment().ranks
      ).map((rank) => ({ name: rank.name, minimumXp: rank.minimumXp })),
      rules: {
        coinsPerMinute: rules.coinsPerMinute,
        xpPerMinute: rules.xpPerMinute,
        screenedReputation: rules.screenedReputation,
        screenedXp: rules.screenedXp,
        acceptedReputation: rules.acceptedReputation,
        acceptedXp: rules.acceptedXp,
      },
    },
  };
}
export const emptyStreamSurfaces = () =>
  streamSurfaceSnapshot(createEmptyState(), { channelId: "", liveSince: 0 });
