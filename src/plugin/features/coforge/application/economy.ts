import type { InternalState } from "./ports";
import type { Player, RewardEntry } from "../domain/population";
import { playerRestricted } from "../domain/population";
import { recordOperation } from "./population";

function award(state: InternalState, player: Player, entry: Omit<RewardEntry, "at" | "playerId">): void {
  if (
    ![player.coins + entry.coins, player.xp + entry.xp, player.reputation + entry.reputation].every(
      Number.isSafeInteger,
    )
  )
    throw new Error("The player balance exceeds the supported limit.");
  player.coins += entry.coins;
  player.xp += entry.xp;
  player.reputation += entry.reputation;
  state.population.rewards.push({ ...entry, playerId: player.id, at: new Date().toISOString() });
  recordOperation(state, "reward-granted", "committed", player.id);
}
/** Only trusted transitions made in this transaction can earn contribution rewards. */
export function settleContributionRewards(
  previous: InternalState,
  next: InternalState,
  external: readonly string[] = [],
): void {
  const prior = new Map(previous.ideas.map((idea) => [idea.id, idea]));
  let players: Map<string, Player> | undefined;
  for (const idea of next.ideas) {
    if (external.includes(idea.id) || idea.requestKind === "bug") continue;
    const old = prior.get(idea.id);
    if (!old) continue;
    const screened = idea.screening?.verdict === "clear" && old.screening?.verdict !== "clear";
    const polishingSettlement = old.status === 'review' && idea.polishingRuns?.some(pass => pass.previousStatus === 'shipped' && ['applied', 'rejected'].includes(pass.review) &&
      old.polishingRuns?.some(before => before.id === pass.id && before.workflow.id === pass.workflow.id && before.review === 'pending'));
    const accepted = idea.status === "shipped" && old.status !== "shipped" && !polishingSettlement;
    if (!screened && !accepted) continue;
    players ??= new Map(next.population.players.map((player) => [player.id, player]));
    const player = players.get(idea.authorId);
    if (!player?.registeredAt || playerRestricted(player, next.integration.twitchBroadcasterId)) continue;
    for (const reason of ["screened", "accepted"] as const) {
      if (!(reason === "screened" ? screened : accepted)) continue;
      const claim = `${reason}:${idea.id}`;
      if (player.rewardClaims.includes(claim)) continue;
      const rules = next.population.rules;
      award(next, player, {
        id: `${player.id}:${claim}`,
        reason,
        ideaId: idea.id,
        coins: 0,
        xp: reason === "screened" ? rules.screenedXp : rules.acceptedXp,
        reputation: reason === "screened" ? rules.screenedReputation : rules.acceptedReputation,
      });
      player.rewardClaims.push(claim);
    }
  }
}
export interface PresenceCredit {
  id: string;
  channelId: string;
  from: number;
  to: number;
  playerIds: readonly string[];
  subscribers?: { channelId: string; checkedAt: string; playerIds: readonly string[] };
}
/** Caller supplies the intersection of two complete live chat snapshots from the same stream. */
export function creditPresence(state: InternalState, sample: PresenceCredit): void {
  const seconds = Math.floor((sample.to - sample.from) / 1000);
  if (
    !sample.id ||
    sample.id.length > 150 ||
    sample.channelId !== state.integration.twitchBroadcasterId ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > 90 ||
    sample.to > Date.now() + 5000 ||
    state.population.presenceSamples.includes(sample.id)
  )
    return;
  state.population.presenceSamples.push(sample.id);
  let credited = 0;
  const players = new Map(state.population.players.map((player) => [player.id, player]));
  for (const id of new Set(sample.playerIds)) {
    const player = players.get(id);
    if (!player || playerRestricted(player, sample.channelId))
      continue;
    // Legacy registered counters already include only registered intervals; new profiles keep XP separate.
    player.registeredPresenceSeconds ??= player.registeredAt ? player.presenceSeconds : 0;
    player.rewardedXpMinutes ??= player.registeredAt ? player.rewardedMinutes : 0;
    if (player.registeredAt && Date.parse(player.registeredAt) <= sample.from) player.registeredPresenceSeconds += seconds;
    player.presenceSeconds += seconds;
    player.lastSeenAt = new Date(sample.to).toISOString();
    credited++;
    const minutes = Math.floor(player.presenceSeconds / 60) - player.rewardedMinutes;
    const xpMinutes = Math.floor(player.registeredPresenceSeconds / 60) - player.rewardedXpMinutes;
    if (minutes <= 0 && xpMinutes <= 0) continue;
    const rules = state.population.rules;
    const evidence = sample.subscribers;
    const checked = evidence ? Date.parse(evidence.checkedAt) : NaN;
    const trustedSubscriber = evidence?.channelId === sample.channelId && Number.isFinite(checked)
      && checked >= sample.to - 90_000 && checked <= sample.to + 5000 && evidence.playerIds.includes(id);
    const currencyRate = trustedSubscriber ? state.population.economy?.definition.premiumCurrencyPerMinute ?? rules.coinsPerMinute : rules.coinsPerMinute;
    award(state, player, {
      id: `${id}:${sample.id}`,
      reason: "presence",
      coins: minutes * currencyRate,
      xp: xpMinutes * rules.xpPerMinute,
      reputation: 0,
    });
    player.rewardedMinutes += minutes;
    player.rewardedXpMinutes += xpMinutes;
  }
  if (credited) recordOperation(state, "presence-credited", "committed", undefined, credited);
}
