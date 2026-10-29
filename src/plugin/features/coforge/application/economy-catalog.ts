import { compactEconomyLabel, economyRowPages } from "./economy-reply";
import type { ParsedCommand } from "../domain/commands";
import type {
  EconomyDefinition,
  EconomyUsage,
} from "../domain/command-economy";
import type { InternalState } from "./ports";
import type { ChatResult } from "./chat";
import { defaultEconomyDefinition } from "../domain/command-economy";
import { publicProgressVisible } from "./public-command-policy";
export type EconomyCatalogCommand = Extract<
  ParsedCommand,
  { type: "shop" | "odds" | "redeem" | "lootbox" }
>;
export function economyPurchase(
  definition: EconomyDefinition,
  command: ParsedCommand,
): EconomyUsage["purchase"] {
  if (command.type === "redeem") {
    const reward = definition.rewards.find(
      (reward) => reward.id === command.rewardId,
    );
    if (!reward)
      throw new Error(
        "That reward is unavailable. Use !shop for current IDs and total costs.",
      );
    return {
      kind: "reward",
      id: reward.id,
      name: reward.name,
      cost: reward.cost,
    };
  }
  if (command.type === "lootbox") {
    const box = definition.lootboxes.find(
      (box) => box.id === command.lootboxId,
    );
    if (!box)
      throw new Error(
        "That lootbox is unavailable. Use !shop for current IDs and total costs.",
      );
    return { kind: "lootbox", id: box.id, name: box.name, cost: box.cost };
  }
  return undefined;
}
export function economyCatalog(
  state: InternalState,
  command: EconomyCatalogCommand,
  playerId: string,
  publicOnly: boolean,
): ChatResult {
  const definition =
    state.population.economy?.definition ?? defaultEconomyDefinition();
  const currency = compactEconomyLabel(
    state.population.environment.currencyName,
  );
  const player = state.population.players.find(
    (player) => player.id === playerId,
  );
  if (command.type === "shop") {
    const visibleBalance =
      player && (!publicOnly || publicProgressVisible(state, player));
    const items = [
      ...definition.rewards.map((reward) => ({
        id: reward.id,
        name: reward.name,
        cost: reward.cost + definition.commandRules.redeem.cost,
        verb: "!redeem",
        kind: reward.kind === "perk" ? "manual perk" : "virtual",
      })),
      ...definition.lootboxes.map((box) => ({
        id: box.id,
        name: box.name,
        cost: box.cost + definition.commandRules.lootbox.cost,
        verb: "!lootbox",
        kind: "random; !odds",
      })),
    ];
    if (!items.length)
      return {
        ok: true,
        message:
          "The reward shop is empty. The streamer has not configured rewards or lootboxes.",
      };
    const rows = items.map(
      (item) =>
        `${item.verb} ${item.id} (${compactEconomyLabel(item.name, 12)}; ${item.kind}): ${item.cost} ${currency} total; ${visibleBalance ? (player.coins >= item.cost ? "affordable before shop fee" : "insufficient before shop fee") : "affordability private"}`,
    );
    const pages = economyRowPages(rows, 270);
    const page = Math.min(command.page, pages.length);
    return {
      ok: true,
      message: `Shop ${page}/${pages.length}: ${pages[page - 1]!.join(" · ")}. Prices include item + command fee.${page < pages.length ? ` Next: !shop ${page + 1}.` : ""}`,
    };
  }
  if (command.type === "odds") {
    const box = definition.lootboxes.find(
      (box) => box.id === command.lootboxId,
    );
    if (!box)
      return {
        ok: false,
        message: "That lootbox is unavailable. Use !shop for current IDs.",
      };
    const total = box.entries.reduce((sum, entry) => sum + entry.weight, 0);
    const weights = new Map<string, number>();
    for (const entry of box.entries)
      weights.set(
        entry.rewardId,
        (weights.get(entry.rewardId) ?? 0) + entry.weight,
      );
    const rows = [...weights].map(
      ([id, weight]) =>
        `${id} ${compactEconomyLabel(definition.rewards.find((reward) => reward.id === id)?.name ?? id, 12)}: ${weight}/${total} (${((weight / total) * 100).toFixed(2)}%)`,
    );
    const pages = economyRowPages(rows, 150);
    const page = Math.min(command.page, pages.length);
    const price = box.cost + definition.commandRules.lootbox.cost;
    return {
      ok: true,
      message: `Odds ${page}/${pages.length}: ${pages[page - 1]!.join(" · ")}. Purchase total: ${price} ${currency} (fee + box).${page < pages.length ? ` Next: !odds ${box.id} ${page + 1}.` : ` Buy: !lootbox ${box.id}.`}`,
    };
  }
  try {
    const purchase = economyPurchase(definition, command);
    return { ok: true, message: `Purchased ${purchase!.name}.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The catalog item is unavailable.",
    };
  }
}
