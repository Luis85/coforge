import { achievedRank, defaultCommunityEnvironment, type CommunityEnvironment } from "./community-environment";
export interface EconomyRules {
  coinsPerMinute: number;
  xpPerMinute: number;
  screenedReputation: number;
  screenedXp: number;
  acceptedReputation: number;
  acceptedXp: number;
}
export interface PlayerRestriction {
  channelId: string;
  checkedAt: string;
  expiresAt?: string;
  banned: boolean;
}
export interface Player {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  registeredAt?: string;
  greetedAt?: string;
  blocked: boolean;
  restriction?: PlayerRestriction;
  lastFeatureAt?: string;
  moderationPending?: { channelId: string; at: string; operationId?: string };
  coins: number;
  xp: number;
  reputation: number;
  presenceSeconds: number;
  rewardedMinutes: number;
  rewardClaims: string[];
}
export const OPERATION_CODES = [
  "registered",
  "greeted",
  "message-observed",
  "participation-rejected",
  "cooldown-rejected",
  "request-created",
  "bug-created",
  "vote-counted",
  "duplicate-event",
  "presence-credited",
  "presence-failed",
  "reply-confirmed",
  "reply-failed",
  "reply-uncertain",
  "connected",
  "disconnected",
  "moderation-started",
  "moderation-confirmed",
  "moderation-failed",
  "moderation-uncertain",
  "blocked",
  "unblocked",
  "rules-updated",
  "reward-granted",
  "broadcast-queued",
  "command-observed",
  "command-rejected",
  "job-started",
  "job-completed",
  "job-failed",
  "job-cancelled",
  "broadcast-skipped",
] as const;
export type OperationCode = (typeof OPERATION_CODES)[number];
export interface OperationRecord {
  sequence: number;
  at: string;
  code: OperationCode;
  effect: "none" | "committed" | "uncertain";
  count: number;
  playerId?: string;
}
export interface RewardEntry {
  id: string;
  at: string;
  playerId: string;
  reason: "presence" | "screened" | "accepted";
  coins: number;
  xp: number;
  reputation: number;
  ideaId?: string;
}
export interface PopulationState {
  players: Player[];
  rules: EconomyRules;
  rewards: RewardEntry[];
  operations: OperationRecord[];
  environment: CommunityEnvironment;
  counters: Partial<Record<OperationCode, number>>;
  nextSequence: number;
  droppedOperations: number;
  droppedRewards: number;
  presenceSamples: string[];
}
export const defaultEconomyRules = (): EconomyRules => ({
  coinsPerMinute: 1,
  xpPerMinute: 1,
  screenedReputation: 10,
  screenedXp: 10,
  acceptedReputation: 50,
  acceptedXp: 50,
});
export const emptyPopulation = (): PopulationState => ({
  players: [],
  rules: defaultEconomyRules(),
  environment: defaultCommunityEnvironment(),
  rewards: [],
  operations: [],
  counters: {},
  nextSequence: 1,
  droppedOperations: 0,
  droppedRewards: 0,
  presenceSamples: [],
});
export const playerRank = (player: Player, environment: CommunityEnvironment): number =>
  achievedRank(player.xp, environment).position;
export function playerRestricted(player: Player, channelId = "", now = Date.now()): boolean {
  return (
    player.blocked ||
    player.moderationPending?.channelId === channelId ||
    Boolean(
      player.restriction &&
      player.restriction.channelId === channelId &&
      (player.restriction.banned || (player.restriction.expiresAt && Date.parse(player.restriction.expiresAt) > now)),
    )
  );
}
