import type { InternalState } from "./ports";
/** Only explicit simulator provenance with no retained real request dependency may be removed. */
export function cleanupEconomyExamples(
  state: InternalState,
  selected: ReadonlySet<string>,
) {
  const economy = state.population.economy;
  if (!economy) return { usages: 0, perks: 0 };
  const removed = economy.usages.filter(
    (usage) =>
      usage.source === "simulator" &&
      (!usage.ideaId || selected.has(usage.ideaId)),
  );
  const ids = new Set(removed.map((usage) => usage.id));
  const removedPerks = economy.redemptions.filter(
    (perk) =>
      perk.source === "simulator" &&
      (!perk.ideaId || selected.has(perk.ideaId)),
  );
  const reversals = new Map<
    string,
    { coins: number; xp: number; reputation: number }
  >();
  for (const usage of removed) {
    const delta = reversals.get(usage.playerId) ?? {
      coins: 0,
      xp: 0,
      reputation: 0,
    };
    delta.coins += usage.cost - usage.benefits.coins;
    delta.xp -= usage.benefits.xp;
    delta.reputation -= usage.benefits.reputation;
    for (const award of usage.awards)
      if (award.reward.kind === "virtual") {
        delta.coins -= award.reward.coins;
        delta.xp -= award.reward.xp;
        delta.reputation -= award.reward.reputation;
      }
    reversals.set(usage.playerId, delta);
  }
  for (const [id, delta] of reversals) {
    const player = state.population.players.find(
      (player) => player.id === id && id.startsWith("simulator:"),
    );
    if (!player) continue;
    const values = [
      player.coins + delta.coins,
      player.xp + delta.xp,
      player.reputation + delta.reputation,
    ];
    if (!values.every(Number.isSafeInteger))
      throw new Error(
        "The retained profile balance cannot be safely reconciled. No example data was removed.",
      );
    // Clamp only after aggregating: reversing an earned credit then its purchase must not mint the purchase fee.
    [player.coins, player.xp, player.reputation] = [
      Math.max(0, values[0]!),
      Math.max(0, values[1]!),
      Math.max(0, values[2]!),
    ];
  }
  economy.usages = economy.usages.filter((usage) => !ids.has(usage.id));
  const perks = new Set(removedPerks.map((perk) => perk.id));
  economy.redemptions = economy.redemptions.filter(
    (perk) => !perks.has(perk.id),
  );
  // Private draw reservations and effect tombstones remain durable after readable examples are removed.
  return { usages: removed.length, perks: removedPerks.length };
}
