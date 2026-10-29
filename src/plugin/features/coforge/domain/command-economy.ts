import type { ChatSource } from "./types";
export const ECONOMY_COMMANDS = [
  "help",
  "register",
  "projects",
  "ranks",
  "request",
  "bug",
  "context",
  "vote",
  "status",
  "me",
  "shop",
  "odds",
  "redeem",
  "lootbox",
] as const;
export type EconomyCommand = (typeof ECONOMY_COMMANDS)[number];
export interface EconomyBenefits {
  coins: number;
  xp: number;
  reputation: number;
}
export interface EconomyCommandRule {
  cost: number;
  benefits: EconomyBenefits;
  rewardIds: string[];
  lootboxIds: string[];
}
export type EconomyReward =
  | ({
      id: string;
      name: string;
      kind: "virtual";
      cost: number;
    } & EconomyBenefits)
  | {
      id: string;
      name: string;
      kind: "perk";
      cost: number;
      description: string;
    };
export interface EconomyLootbox {
  id: string;
  name: string;
  cost: number;
  entries: Array<{ rewardId: string; weight: number }>;
}
export type EconomyAcquisition =
  "command-bonus" | "reward-purchase" | "lootbox";
export interface EconomyAward {
  reward: EconomyReward;
  acquisition: EconomyAcquisition;
  lootboxId?: string;
}
export interface EconomyDefinition {
  format: "coforge-economy/v1";
  commandRules: Record<EconomyCommand, EconomyCommandRule>;
  /** Total subscriber rate, replacing base; absence inherits the existing base currency rule. */
  premiumCurrencyPerMinute?: number;
  rewards: EconomyReward[];
  lootboxes: EconomyLootbox[];
}
export interface EconomyRoll {
  lootboxId: string;
  lootboxName: string;
  ticket: number;
  totalWeight: number;
  entries: Array<{ rewardId: string; weight: number }>;
  reward: EconomyReward;
}
export interface EconomyUsage {
  id: string;
  eventKey: string;
  playerId: string;
  source?: ChatSource;
  channelId?: string;
  ideaId?: string;
  command: EconomyCommand;
  createdAt: string;
  configurationRevision: number;
  cost: number;
  commandCost: number;
  purchaseCost: number;
  purchase?: {
    kind: "reward" | "lootbox";
    id: string;
    name: string;
    cost: number;
  };
  benefits: EconomyBenefits;
  awards: EconomyAward[];
  rolls: EconomyRoll[];
}
export interface EconomyPerkRedemption {
  id: string;
  usageId: string;
  source?: ChatSource;
  channelId?: string;
  ideaId?: string;
  playerId: string;
  rewardId: string;
  rewardName: string;
  description: string;
  acquisition: EconomyAcquisition;
  createdAt: string;
  status: "pending" | "fulfilled";
  revision: number;
  fulfilledAt?: string;
  fulfillmentNote?: string;
}
export interface EconomyState {
  configurationRevision: number;
  definition: EconomyDefinition;
  usages: EconomyUsage[];
  /** Durable effect receipts survive readable-history trimming and prevent replay. */
  usageTombstones: Record<
    string,
    {
      outcome: "committed" | "rejected" | "duplicate";
      at: string;
      usageId?: string;
    }
  >;
  redemptions: EconomyPerkRedemption[];
  droppedUsages: number;
}
export interface EconomyConfigurationInput {
  definition: EconomyDefinition;
  coinsPerMinute: number;
}
export interface EconomySnapshot {
  definition: EconomyDefinition;
  configurationRevision: number;
  configurationIdentity: string;
  coinsPerMinute: number;
  currencyName: string;
  usages: EconomyUsage[];
  redemptions: EconomyPerkRedemption[];
  droppedUsages: number;
}
export const emptyEconomyBenefits = (): EconomyBenefits => ({
  coins: 0,
  xp: 0,
  reputation: 0,
});
export const emptyEconomyRule = (): EconomyCommandRule => ({
  cost: 0,
  benefits: emptyEconomyBenefits(),
  rewardIds: [],
  lootboxIds: [],
});
export const defaultEconomyDefinition = (): EconomyDefinition => ({
  format: "coforge-economy/v1",
  commandRules: {
    help: emptyEconomyRule(),
    register: emptyEconomyRule(),
    projects: emptyEconomyRule(),
    ranks: emptyEconomyRule(),
    request: emptyEconomyRule(),
    bug: emptyEconomyRule(),
    context: emptyEconomyRule(),
    vote: emptyEconomyRule(),
    status: emptyEconomyRule(),
    me: emptyEconomyRule(),
    shop: emptyEconomyRule(),
    odds: emptyEconomyRule(),
    redeem: emptyEconomyRule(),
    lootbox: emptyEconomyRule(),
  },
  rewards: [],
  lootboxes: [],
});

export interface EconomyUsageReservation {
  format: "coforge-economy-reservation/v1";
  eventKey: string;
  inputIdentity: string;
  definition: EconomyDefinition;
  configurationRevision: number;
  usage: EconomyUsage;
}
export interface EconomyReservationPort {
  reserve(
    eventKey: string,
    inputIdentity: string,
    prepare: (
      draw: (maxExclusive: number) => number,
    ) => EconomyUsageReservation,
  ): Promise<EconomyUsageReservation>;
}
