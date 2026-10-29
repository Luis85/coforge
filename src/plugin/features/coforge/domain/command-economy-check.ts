import { verifyEconomyReservation } from "./economy-reservation-integrity";
import {
  CheckError,
  list,
  number,
  oneOf,
  optional,
  record,
  shape,
  text,
  timestamp,
  type Check,
} from "./check";
import {
  ECONOMY_COMMANDS,
  type EconomyDefinition,
  type EconomyReward,
  type EconomyState,
  type EconomyUsageReservation,
} from "./command-economy";
export const economyCount = number({
  integer: true,
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
});
const rate = number({ integer: true, min: 0, max: 100_000 });
const id = text({ min: 1, max: 100, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/ });
const identity = text({ min: 1, max: 500 });
const name = text({ min: 1, max: 100, trim: true });
export const economyBenefitsCheck = shape(
  { coins: rate, xp: rate, reputation: rate },
  { strict: true },
);
export const economyRewardCheck: Check<EconomyReward> = (value, path) => {
  const input = record(value, path);
  return input.kind === "virtual"
    ? shape(
        {
          id,
          name,
          kind: oneOf(["virtual"] as const),
          cost: rate,
          coins: rate,
          xp: rate,
          reputation: rate,
        },
        { strict: true },
      )(value, path)
    : shape(
        {
          id,
          name,
          kind: oneOf(["perk"] as const),
          cost: rate,
          description: text({ min: 1, max: 1000, trim: true }),
        },
        { strict: true },
      )(value, path);
};
const entry = shape({ rewardId: id, weight: rate }, { strict: true });
const box = shape(
  { id, name, cost: rate, entries: list(entry, { min: 1, max: 100 }) },
  { strict: true },
);
const rule = shape(
  {
    cost: rate,
    benefits: economyBenefitsCheck,
    rewardIds: list(id, { max: 20 }),
    lootboxIds: list(id, { max: 20 }),
  },
  { strict: true },
);
function unique(ids: string[], path: string): void {
  if (new Set(ids).size !== ids.length)
    throw new CheckError(path, "duplicate identifiers are not allowed");
}
export const economyDefinitionCheck: Check<EconomyDefinition> = (
  value,
  path = "",
) => {
  const parsed = shape(
    {
      format: oneOf(["coforge-economy/v1"] as const),
      commandRules: record,
      premiumCurrencyPerMinute: optional(rate),
      rewards: list(economyRewardCheck, { max: 100 }),
      lootboxes: list(box, { max: 100 }),
    },
    { strict: true },
  )(value, path);
  const rules = parsed.commandRules;
  for (const key of Object.keys(rules))
    oneOf(ECONOMY_COMMANDS)(key, path + ".commandRules");
  const commandRules = {
    help: rule(rules.help),
    register: rule(rules.register),
    projects: rule(rules.projects),
    ranks: rule(rules.ranks),
    request: rule(rules.request),
    bug: rule(rules.bug),
    context: rule(rules.context),
    vote: rule(rules.vote),
    status: rule(rules.status),
    me: rule(rules.me),
    shop: rule(rules.shop),
    odds: rule(rules.odds),
    redeem: rule(rules.redeem),
    lootbox: rule(rules.lootbox),
  };
  unique(
    parsed.rewards.map((reward) => reward.id),
    path + ".rewards",
  );
  unique(
    parsed.lootboxes.map((item) => item.id),
    path + ".lootboxes",
  );
  const rewards = new Set(parsed.rewards.map((reward) => reward.id));
  const boxes = new Set(parsed.lootboxes.map((item) => item.id));
  for (const item of parsed.lootboxes) {
    if (!item.entries.some((entry) => entry.weight > 0))
      throw new CheckError(
        path,
        "each lootbox needs a positive outcome weight",
      );
    for (const entry of item.entries)
      if (!rewards.has(entry.rewardId))
        throw new CheckError(path, "lootbox references an unknown reward");
  }
  for (const item of Object.values(commandRules)) {
    unique(item.rewardIds, path);
    unique(item.lootboxIds, path);
    if (
      item.rewardIds.some((id) => !rewards.has(id)) ||
      item.lootboxIds.some((id) => !boxes.has(id))
    )
      throw new CheckError(
        path,
        "command references an unknown reward or lootbox",
      );
  }
  return { ...parsed, commandRules };
};
const acquisition = oneOf([
  "command-bonus",
  "reward-purchase",
  "lootbox",
] as const);
const award = shape(
  { reward: economyRewardCheck, acquisition, lootboxId: optional(id) },
  { strict: true },
);
const roll = shape(
  {
    lootboxId: id,
    lootboxName: name,
    ticket: economyCount,
    totalWeight: economyCount,
    entries: list(entry, { min: 1, max: 100 }),
    reward: economyRewardCheck,
  },
  { strict: true },
);
const source = optional(oneOf(["simulator", "twitch", "api"] as const));
export const economyUsageCheck = shape(
  {
    id: identity,
    eventKey: identity,
    playerId: identity,
    source,
    channelId: optional(identity),
    ideaId: optional(identity),
    command: oneOf(ECONOMY_COMMANDS),
    createdAt: timestamp,
    configurationRevision: economyCount,
    cost: economyCount,
    commandCost: economyCount,
    purchaseCost: economyCount,
    purchase: optional(
      shape(
        {
          kind: oneOf(["reward", "lootbox"] as const),
          id,
          name,
          cost: economyCount,
        },
        { strict: true },
      ),
    ),
    benefits: economyBenefitsCheck,
    awards: list(award, { max: 50 }),
    rolls: list(roll, { max: 21 }),
  },
  { strict: true },
);
const redemption = shape(
  {
    id: identity,
    usageId: identity,
    playerId: identity,
    source,
    channelId: optional(identity),
    ideaId: optional(identity),
    rewardId: id,
    rewardName: name,
    description: text({ min: 1, max: 1000 }),
    acquisition,
    createdAt: timestamp,
    status: oneOf(["pending", "fulfilled"] as const),
    revision: economyCount,
    fulfilledAt: optional(timestamp),
    fulfillmentNote: optional(text({ max: 2000 })),
  },
  { strict: true },
);
export const economyStateCheck: Check<EconomyState> = shape(
  {
    configurationRevision: economyCount,
    definition: economyDefinitionCheck,
    usages: list(economyUsageCheck, { max: 2000 }),
    usageTombstones: (value, path) =>
      Object.fromEntries(
        Object.entries(record(value, path)).map(([key, receipt]) => [
          identity(key),
          shape(
            {
              outcome: oneOf(["committed", "rejected", "duplicate"] as const),
              at: timestamp,
              usageId: optional(identity),
            },
            { strict: true },
          )(receipt),
        ]),
      ),
    redemptions: list(redemption),
    droppedUsages: economyCount,
  },
  { strict: true },
);
export const economyUsageReservationCheck: Check<EconomyUsageReservation> = (
  value,
  path,
) => {
  const parsed = shape(
    {
      format: oneOf(["coforge-economy-reservation/v1"] as const),
      eventKey: identity,
      inputIdentity: text({ min: 1, max: 12000 }),
      definition: economyDefinitionCheck,
      configurationRevision: economyCount,
      usage: economyUsageCheck,
    },
    { strict: true },
  )(value, path);
  if (
    parsed.eventKey !== parsed.usage.eventKey ||
    parsed.configurationRevision !== parsed.usage.configurationRevision
  )
    throw new CheckError(
      path ?? "",
      "reservation identity does not match its usage",
    );
  for (const item of parsed.usage.rolls) {
    const total = item.entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total !== item.totalWeight || item.ticket >= total || total <= 0)
      throw new CheckError(path ?? "", "invalid frozen random ticket");
    let cursor = item.ticket;
    const winner = item.entries.find((entry) => (cursor -= entry.weight) < 0);
    if (winner?.rewardId !== item.reward.id)
      throw new CheckError(path ?? "", "ticket and frozen outcome disagree");
  }
  verifyEconomyReservation(parsed);
  return parsed;
};
