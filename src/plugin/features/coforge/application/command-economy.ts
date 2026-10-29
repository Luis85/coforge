import { compactEconomyLabel, economySettledReply } from "./economy-reply";
import {
  ECONOMY_COMMANDS,
  defaultEconomyDefinition,
  type EconomyCommand,
  type EconomyUsage,
  type EconomyUsageReservation,
  type EconomyReservationPort,
  type EconomyRoll,
} from "../domain/command-economy";
import type { ParsedCommand } from "../domain/commands";
import type { ChatSource } from "../domain/types";
import type { InternalState } from "./ports";
import type { ChatResult } from "./chat";
import { economyPurchase } from "./economy-catalog";
import { publicProgressVisible } from "./public-command-policy";
import { playerRestricted } from "../domain/population";
import { ensureEconomyState } from "./economy-configuration";
import { economyUsageReservationCheck } from "../domain/command-economy-check";
export const isEconomyCommand = (
  command: ParsedCommand,
): command is ParsedCommand & { type: EconomyCommand } =>
  ECONOMY_COMMANDS.some((type) => type === command.type);
export interface EconomyCommandContext {
  eventKey: string;
  inputIdentity: string;
  playerId: string;
  source: ChatSource;
  channelId?: string;
  now: string;
}
class Unaffordable extends Error {}
class NoPriorReservation extends Error {}
function roll(
  definition: EconomyUsageReservation["definition"],
  id: string,
  draw: (max: number) => number,
): EconomyRoll {
  const box = definition.lootboxes.find((box) => box.id === id);
  if (!box) throw new Error("The captured lootbox is unavailable.");
  const totalWeight = box.entries.reduce((sum, entry) => sum + entry.weight, 0);
  const ticket = draw(totalWeight);
  if (!Number.isSafeInteger(ticket) || ticket < 0 || ticket >= totalWeight)
    throw new Error("The random source returned an invalid ticket.");
  let cursor = ticket;
  const winning = box.entries.find((entry) => (cursor -= entry.weight) < 0);
  const reward = definition.rewards.find(
    (reward) => reward.id === winning?.rewardId,
  );
  if (!reward) throw new Error("The captured random outcome is unavailable.");
  return {
    lootboxId: box.id,
    lootboxName: box.name,
    ticket,
    totalWeight,
    entries: structuredClone(box.entries),
    reward: structuredClone(reward),
  };
}
/** All effects remain inside the enclosing FIFO transaction; reservation evidence precedes any durable command effect. */
export async function settleEconomyCommand(
  state: InternalState,
  command: ParsedCommand,
  result: ChatResult,
  context: EconomyCommandContext,
  reservations?: EconomyReservationPort,
): Promise<string | undefined> {
  if (!isEconomyCommand(command)) return;
  const economy = ensureEconomyState(state);
  let recovered: EconomyUsageReservation | undefined;
  const currentPlayer = state.population.players.find(
    (player) => player.id === context.playerId,
  );
  if (
    !result.ok &&
    (command.type === "redeem" || command.type === "lootbox") &&
    reservations &&
    currentPlayer &&
    !playerRestricted(currentPlayer, state.integration.twitchBroadcasterId)
  ) {
    try {
      recovered = await reservations.reserve(
        context.eventKey,
        context.inputIdentity,
        () => {
          throw new NoPriorReservation();
        },
      );
    } catch (error) {
      if (!(error instanceof NoPriorReservation)) throw error;
    }
    if (recovered) {
      result.ok = true;
      result.message = `Purchased ${recovered.usage.purchase?.name ?? "the captured item"} using this event's retained rules.`;
    }
  }
  if (!result.ok || result.duplicate) {
    economy.usageTombstones[context.eventKey] = {
      outcome: result.duplicate ? "duplicate" : "rejected",
      at: context.now,
    };
    return;
  }
  const player = state.population.players.find(
    (player) => player.id === context.playerId,
  );
  if (
    !player ||
    playerRestricted(player, state.integration.twitchBroadcasterId)
  )
    return "This profile is restricted. The command was not applied or charged.";
  const insufficient = (cost: number) =>
    context.source !== "simulator" && !publicProgressVisible(state, player)
      ? "This command could not be applied. Ask the streamer to review your account privately."
      : `Insufficient ${state.population.environment.currencyName}: this command costs ${cost} total. No charge or reward was applied.`;
  const prepare = (draw: (max: number) => number): EconomyUsageReservation => {
    const definition = structuredClone(
      economy.definition ?? defaultEconomyDefinition(),
    );
    const rule = definition.commandRules[command.type];
    const purchase = economyPurchase(definition, command);
    const cost = rule.cost + (purchase?.cost ?? 0);
    if (player.coins < cost) throw new Unaffordable(insufficient(cost));
    const awards: EconomyUsage["awards"] = rule.rewardIds.map((id) => ({
      reward: structuredClone(
        definition.rewards.find((reward) => reward.id === id)!,
      ),
      acquisition: "command-bonus",
    }));
    if (purchase?.kind === "reward")
      awards.push({
        reward: structuredClone(
          definition.rewards.find((reward) => reward.id === purchase.id)!,
        ),
        acquisition: "reward-purchase",
      });
    const rolls = [
      ...rule.lootboxIds,
      ...(purchase?.kind === "lootbox" ? [purchase.id] : []),
    ].map((id) => roll(definition, id, draw));
    for (const outcome of rolls)
      awards.push({
        reward: outcome.reward,
        acquisition: "lootbox",
        lootboxId: outcome.lootboxId,
      });
    const usage: EconomyUsage = {
      id: context.eventKey,
      eventKey: context.eventKey,
      playerId: context.playerId,
      source: context.source,
      ...(context.channelId ? { channelId: context.channelId } : {}),
      command: command.type,
      createdAt: context.now,
      configurationRevision: economy.configurationRevision,
      cost,
      commandCost: rule.cost,
      purchaseCost: purchase?.cost ?? 0,
      ...(purchase ? { purchase } : {}),
      benefits: structuredClone(rule.benefits),
      awards,
      rolls,
    };
    return economyUsageReservationCheck({
      format: "coforge-economy-reservation/v1",
      eventKey: context.eventKey,
      inputIdentity: context.inputIdentity,
      definition,
      configurationRevision: economy.configurationRevision,
      usage,
    });
  };
  let reservation: EconomyUsageReservation;
  try {
    const randomConfigured =
      economy.definition.commandRules[command.type].lootboxIds.length > 0 ||
      command.type === "lootbox";
    if (recovered) reservation = recovered;
    else if (reservations)
      reservation = await reservations.reserve(
        context.eventKey,
        context.inputIdentity,
        prepare,
      );
    else {
      if (randomConfigured)
        throw new Error(
          "Durable random-reward storage is unavailable. No command effect or charge was committed.",
        );
      reservation = prepare(() => {
        throw new Error("Durable random-reward storage is unavailable.");
      });
    }
  } catch (error) {
    if (error instanceof Unaffordable) return error.message;
    throw error;
  }
  const usage = economyUsageReservationCheck(reservation).usage;
  if (
    reservation.eventKey !== context.eventKey ||
    reservation.inputIdentity !== context.inputIdentity ||
    usage.playerId !== context.playerId ||
    usage.source !== context.source ||
    (usage.channelId ?? "") !== (context.channelId ?? "") ||
    usage.id !== context.eventKey ||
    usage.command !== command.type
  )
    throw new Error(
      "The durable command reservation does not match this event. No command effect was committed.",
    );
  if (player.coins < usage.cost) return insufficient(usage.cost);
  const benefits = { ...usage.benefits };
  for (const award of usage.awards)
    if (award.reward.kind === "virtual") {
      benefits.coins += award.reward.coins;
      benefits.xp += award.reward.xp;
      benefits.reputation += award.reward.reputation;
    }
  const next = [
    player.coins - usage.cost + benefits.coins,
    player.xp + benefits.xp,
    player.reputation + benefits.reputation,
  ];
  if (!next.every(Number.isSafeInteger))
    throw new Error("The player balance exceeds the supported limit.");
  [player.coins, player.xp, player.reputation] = [next[0]!, next[1]!, next[2]!];
  if (
    result.ideaId &&
    (usage.cost ||
      benefits.coins ||
      benefits.xp ||
      benefits.reputation ||
      usage.awards.length)
  ) {
    const claim = `command:${result.ideaId}`;
    if (!player.rewardClaims.includes(claim)) player.rewardClaims.push(claim);
  }
  const committed = {
    ...structuredClone(usage),
    ...(result.ideaId ? { ideaId: result.ideaId } : {}),
  };
  economy.usages.push(committed);
  economy.usageTombstones[context.eventKey] = {
    outcome: "committed",
    at: context.now,
    usageId: usage.id,
  };
  usage.awards.forEach((award, index) => {
    if (award.reward.kind !== "perk") return;
    economy.redemptions.push({
      id: `${usage.id}:perk:${index}`,
      usageId: usage.id,
      playerId: player.id,
      source: context.source,
      ...(context.channelId ? { channelId: context.channelId } : {}),
      ...(result.ideaId ? { ideaId: result.ideaId } : {}),
      rewardId: award.reward.id,
      rewardName: award.reward.name,
      description: award.reward.description,
      acquisition: award.acquisition,
      createdAt: context.now,
      status: "pending",
      revision: 1,
    });
  });
  const dropped = Math.max(0, economy.usages.length - 2000);
  if (dropped) {
    economy.usages.splice(0, dropped);
    economy.droppedUsages += dropped;
  }
  if (
    usage.cost ||
    benefits.coins ||
    benefits.xp ||
    benefits.reputation ||
    usage.awards.length
  )
    result.message = economySettledReply(
      result.message,
      `Charged ${usage.cost} ${compactEconomyLabel(state.population.environment.currencyName, 12)}; +${benefits.coins} currency/+${benefits.xp} XP/+${benefits.reputation} rep; rewards ${usage.awards.length}/draws ${usage.rolls.length}/manual ${usage.awards.filter((award) => award.reward.kind === "perk").length}. Full receipt: streamer.`,
      usage.rolls.map((outcome) => ({
        id: outcome.reward.id,
        name: outcome.reward.name,
      })),
    );
}
