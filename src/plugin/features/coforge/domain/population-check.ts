import { boolean, list, number, oneOf, optional, record, shape, text, timestamp } from "./check";
import { OPERATION_CODES, type PopulationState } from "./population";
import { communityEnvironmentCheck, defaultCommunityEnvironment } from "./community-environment";
import { omit } from "./objects";
const count = number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER });
const rate = number({ integer: true, min: 0, max: 100_000 });
export const economyRulesCheck = shape(
  {
    coinsPerMinute: rate,
    xpPerMinute: rate,
    screenedReputation: rate,
    screenedXp: rate,
    acceptedReputation: rate,
    acceptedXp: rate,
  },
  { strict: true },
);
const identity = text({ min: 1, max: 120 });
const player = shape({
  id: identity,
  firstSeenAt: timestamp,
  lastSeenAt: timestamp,
  registeredAt: optional(timestamp),
  greetedAt: optional(timestamp),
  blocked: boolean,
  restriction: optional(
    shape({ channelId: identity, checkedAt: timestamp, expiresAt: optional(timestamp), banned: boolean }),
  ),
  moderationPending: optional(shape({ channelId: identity, at: timestamp, operationId: optional(identity) })),
  lastFeatureAt: optional(timestamp),
  coins: count,
  xp: count,
  reputation: count,
  presenceSeconds: count,
  rewardedMinutes: count,
  rewardClaims: list(text({ max: 100 })),
});
const population = shape({
  players: list(player),
  rules: economyRulesCheck,
  environment: communityEnvironmentCheck,
  rewards: list(
    shape({
      id: identity,
      at: timestamp,
      playerId: identity,
      reason: oneOf(["presence", "screened", "accepted"] as const),
      coins: count,
      xp: count,
      reputation: count,
      ideaId: optional(identity),
    }),
  ),
  operations: list(
    shape({
      sequence: count,
      entityId: optional(text({ min: 1, max: 300 })),
      at: timestamp,
      code: oneOf(OPERATION_CODES),
      effect: oneOf(["none", "committed", "uncertain"] as const),
      count,
      playerId: optional(identity),
    }),
  ),
  counters: (value: unknown) =>
    Object.fromEntries(
      Object.entries(record(value)).map(([key, value]) => [oneOf(OPERATION_CODES)(key), count(value)]),
    ),
  nextSequence: number({ integer: true, min: 1 }),
  droppedOperations: count,
  droppedRewards: count,
  presenceSamples: list(text({ max: 200 })),
});
export function populationCheck(value: unknown): PopulationState {
  const input = record(value);
  return population({
    ...input,
    rules: omit(record(input.rules), "xpPerRank"),
    environment: input.environment ?? defaultCommunityEnvironment(),
  });
}
