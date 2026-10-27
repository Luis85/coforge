import type { InternalState } from "./ports";
import type { CoforgeMetrics } from "../domain/stream-metrics";
export function metricCounters(state: InternalState): Record<string, number> {
  return { ...state.population.counters };
}
function difference(current: Record<string, number>, previous: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, Math.max(0, value - (previous[key] ?? 0))]),
  );
}
function counts(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of values) result[key] = (result[key] ?? 0) + 1;
  return result;
}
export function coforgeMetrics(
  state: InternalState,
  baseline: Record<string, number>,
  previous: Record<string, number>,
): CoforgeMetrics {
  const players = state.population.players.filter((player) => player.registeredAt);
  const sum = (key: "coins" | "xp" | "reputation" | "presenceSeconds") =>
    players.reduce((total, player) => total + player[key], 0);
  const counters = metricCounters(state);
  return {
    counters,
    streamCounters: difference(counters, baseline),
    intervalCounters: difference(counters, previous),
    registeredPlayers: players.length,
    blockedPlayers: players.filter((player) => player.blocked).length,
    coins: sum("coins"),
    xp: sum("xp"),
    reputation: sum("reputation"),
    chatPresenceSeconds: sum("presenceSeconds"),
    requestsByStatus: counts(state.ideas.map((idea) => idea.status)),
    requestsByProject: counts(state.ideas.map((idea) => idea.projectId ?? "unassigned")),
    botRepliesByStatus: counts(state.botReplies.map((reply) => reply.status)),
  };
}
