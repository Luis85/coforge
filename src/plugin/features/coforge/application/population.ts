import type { InternalState } from "./ports";
import { StudioError } from "../domain/errors";
import { economyRulesCheck } from "../domain/population-check";
import { playerRestricted, type Player, type OperationCode, type OperationRecord } from "../domain/population";
import { communityEnvironmentCheck } from "../domain/community-environment";
import { record } from "../domain/check";

export function recordOperation(
  state: InternalState,
  code: OperationCode,
  effect: OperationRecord["effect"] = "committed",
  playerId?: string,
  count = 1,
): void {
  const population = state.population;
  population.counters[code] = (population.counters[code] ?? 0) + count;
  if (code === "message-observed" || code === "command-observed") return;
  population.operations.push({
    sequence: population.nextSequence++,
    at: new Date().toISOString(),
    code,
    effect,
    count,
    ...(playerId ? { playerId } : {}),
  });
}
export function observePlayer(state: InternalState, id: string, now: string): Player {
  let player = state.population.players.find((player) => player.id === id);
  if (!player) {
    if (state.population.players.length >= 50_000)
      throw new StudioError("The population limit has been reached. Contact the streamer.");
    player = {
      id,
      firstSeenAt: now,
      lastSeenAt: now,
      blocked: false,
      coins: 0,
      xp: 0,
      reputation: 0,
      presenceSeconds: 0,
      rewardedMinutes: 0,
      rewardClaims: [],
    };
    state.population.players.push(player);
  }
  player.lastSeenAt = now;
  return player;
}
export function registerPlayer(
  state: InternalState,
  id: string,
  now = new Date().toISOString(),
): { ok: boolean; message: string } {
  const player = observePlayer(state, id, now);
  if (playerRestricted(player, state.integration.twitchBroadcasterId))
    return { ok: false, message: "Your participation is restricted. Contact the streamer." };
  if (player.registeredAt)
    return {
      ok: true,
      message: "You are already registered. Use !projects to find a game and !me for your player stats.",
    };
  player.registeredAt = now;
  recordOperation(state, "registered", "committed", id);
  player.lastFeatureAt ??= state.ingestMeta.lastRequests[id];
  return {
    ok: true,
    message: `Welcome to The Hood! Registered ${state.population.environment.actorName}. Use !projects, !request <project-id> <feature>, !bug <project-id> <bug> or !vote <request-id>. Feature requests have a 5-minute cooldown.`,
  };
}
export function participationProblem(state: InternalState, id: string): string | null {
  const player = state.population.players.find((player) => player.id === id);
  if (!player?.registeredAt) return "Register with !register before requesting features, reporting bugs or voting.";
  return playerRestricted(player, state.integration.twitchBroadcasterId)
    ? "Your participation is restricted. Contact the streamer."
    : null;
}
export function blockPlayer(state: InternalState, id: string, blocked: boolean): void {
  const player = state.population.players.find((player) => player.id === id && player.registeredAt);
  if (!player) throw new StudioError("Registered player not found.");
  if (player.blocked === blocked) return;
  player.blocked = blocked;
  recordOperation(state, blocked ? "blocked" : "unblocked", "committed", id);
}
export function updateEconomyRules(state: InternalState, input: unknown): void {
  state.population.rules = economyRulesCheck(input);
  recordOperation(state, "rules-updated");
}
export function updateCommunitySettings(state: InternalState, input: unknown): void {
  const values = record(input);
  const environment = communityEnvironmentCheck(values.environment);
  const rules = economyRulesCheck(values.rules);
  state.population.environment = environment;
  state.population.rules = rules;
  recordOperation(state, "rules-updated");
}
export function trimPopulation(state: InternalState): void {
  const population = state.population;
  population.droppedOperations += Math.max(0, population.operations.length - 1000);
  population.operations = population.operations.slice(-1000);
  population.droppedRewards += Math.max(0, population.rewards.length - 2000);
  population.rewards = population.rewards.slice(-2000);
  population.presenceSamples = population.presenceSamples.slice(-2000);
}
