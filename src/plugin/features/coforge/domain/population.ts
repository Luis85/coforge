import { achievedRank, defaultCommunityEnvironment, type CommunityEnvironment } from "./community-environment";
import { OBS_OPERATION_CODES } from './obs';
import { MUSIC_OPERATION_CODES } from './music';
import { HERDR_OPERATION_CODES } from './herdr';
import { SCHEDULE_OPERATION_CODES } from './schedule';
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
  registeredPresenceSeconds?: number;
  rewardedXpMinutes?: number;
  rewardClaims: string[];
}
export const OPERATION_CODES = [
  'twitch-operation-requested', 'twitch-operation-confirmed', 'twitch-operation-failed', 'twitch-operation-uncertain', 'twitch-operation-inspected',
  'twitch-activity-observed', 'twitch-activity-acknowledged', 'twitch-activity-linked', 'twitch-template-saved', 'twitch-template-removed', 'twitch-retention-updated',
  'workflow-nudge-requested', 'workflow-nudge-submitted', 'workflow-nudge-unknown', 'workflow-nudge-recovered',
  'economy-configuration-updated', 'economy-perk-fulfilled',
  'project-visibility-updated',
  'reply-privacy-cancelled',
  'example-content-removed',
  'workflow-definition-updated',
  'workflow-run-started', 'workflow-run-stopped', 'workflow-run-finished', 'workflow-run-awaiting-review',
  'workflow-manual-waiting', 'workflow-manual-completed',
  'job-queued', 'ai-cost-reported', 'ai-cost-manual-updated',
  'project-stage-prompts-updated',
  'project-stage-agents-updated',
  'ai-usage-reported',
  'herdr-workflow-updated',
  'twitch-chat-removed',
  'stream-view-opened', 'stream-view-closed', 'stream-view-blocked',
  'request-context-added',
  'finance-refreshed', 'finance-entry-saved', 'finance-entry-deleted',
  'stream-snapshot-saved', 'stream-history-ended', 'twitch-message-observed', 'twitch-command-observed',
  'stream-setup-opened', 'stream-setup-dismissed', 'stream-setup-completed',
  ...OBS_OPERATION_CODES,
  ...MUSIC_OPERATION_CODES,
  ...HERDR_OPERATION_CODES,
  ...SCHEDULE_OPERATION_CODES,
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
  'project-prompt-updated', 'twitch-channel-update-requested', 'twitch-channel-updated', 'twitch-channel-update-failed', 'twitch-channel-update-uncertain', 'twitch-branding-opened',
] as const;
export type OperationCode = (typeof OPERATION_CODES)[number];
export interface OperationRecord {
  action?: import('./obs-scenes').ObsSceneKind;
  entityId?: string;
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
  economy?: import('./command-economy').EconomyState;
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
