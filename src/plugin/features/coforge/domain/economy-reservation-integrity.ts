import { CheckError } from "./check";
import type { EconomyAward, EconomyUsageReservation } from "./command-economy";
/** A private receipt is validated against its own frozen rules, never mutable current configuration. */
export function verifyEconomyReservation(
  receipt: EconomyUsageReservation,
): void {
  const { definition, usage } = receipt;
  const fail = () => {
    throw new CheckError(
      "",
      "the frozen command receipt does not match its captured Economy rules",
    );
  };
  const rule = definition.commandRules[usage.command];
  if (
    !usage.source ||
    usage.cost !== usage.commandCost + usage.purchaseCost ||
    usage.commandCost !== rule.cost ||
    JSON.stringify(usage.benefits) !== JSON.stringify(rule.benefits)
  )
    fail();
  const purchase = usage.purchase;
  if (usage.command === "redeem") {
    const reward = definition.rewards.find(
      (reward) => reward.id === purchase?.id,
    );
    if (
      !reward ||
      purchase?.kind !== "reward" ||
      purchase.name !== reward.name ||
      purchase.cost !== reward.cost
    )
      fail();
  } else if (usage.command === "lootbox") {
    const box = definition.lootboxes.find((box) => box.id === purchase?.id);
    if (
      !box ||
      purchase?.kind !== "lootbox" ||
      purchase.name !== box.name ||
      purchase.cost !== box.cost
    )
      fail();
  } else if (purchase) fail();
  if (usage.purchaseCost !== (purchase?.cost ?? 0)) fail();
  const expectedRollIds = [
    ...rule.lootboxIds,
    ...(purchase?.kind === "lootbox" ? [purchase.id] : []),
  ];
  if (expectedRollIds.length !== usage.rolls.length) fail();
  const awards: EconomyAward[] = [];
  for (const id of rule.rewardIds) {
    const reward = definition.rewards.find((reward) => reward.id === id);
    if (!reward) return fail();
    awards.push({ reward, acquisition: "command-bonus" });
  }
  if (purchase?.kind === "reward") {
    const reward = definition.rewards.find(
      (reward) => reward.id === purchase.id,
    );
    if (!reward) return fail();
    awards.push({ reward, acquisition: "reward-purchase" });
  }
  usage.rolls.forEach((roll, index) => {
    const box = definition.lootboxes.find(
      (box) => box.id === expectedRollIds[index],
    );
    if (
      !box ||
      box.id !== roll.lootboxId ||
      box.name !== roll.lootboxName ||
      JSON.stringify(box.entries) !== JSON.stringify(roll.entries)
    )
      return fail();
    const total = box.entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (total !== roll.totalWeight || roll.ticket >= total || total <= 0)
      return fail();
    let cursor = roll.ticket;
    const winner = box.entries.find((entry) => (cursor -= entry.weight) < 0);
    const reward = definition.rewards.find(
      (reward) => reward.id === winner?.rewardId,
    );
    if (!reward || JSON.stringify(reward) !== JSON.stringify(roll.reward))
      return fail();
    awards.push({ reward, acquisition: "lootbox", lootboxId: box.id });
  });
  if (JSON.stringify(awards) !== JSON.stringify(usage.awards)) fail();
}
