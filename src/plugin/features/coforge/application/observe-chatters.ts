import type { InternalState } from "./ports";
import { displayName } from "../domain/sanitize";
import { CONTRIBUTOR_COLORS } from "../domain/types";
/** Bulk lookup avoids quadratic scans when a complete chat-presence snapshot contains many unregistered viewers. */
export function observeChatters(
  state: InternalState,
  profiles: ReadonlyArray<{ id: string; name: string }>,
  at: string,
): number {
  const people = new Map(
    state.contributors.map((person) => [person.id, person]),
  );
  const players = new Map(
    state.population.players.map((player) => [player.id, player]),
  );
  let omitted = 0;
  for (const profile of profiles) {
    if (!/^twitch:\d+$/.test(profile.id)) continue;
    let player = players.get(profile.id);
    if (!player && players.size >= 50000) {
      omitted++;
      continue;
    }
    const name = displayName(profile.name).slice(0, 50) || "Twitch viewer";
    const person = people.get(profile.id);
    if (person) person.name = name;
    else {
      const next = {
        id: profile.id,
        name,
        color:
          CONTRIBUTOR_COLORS[
            state.contributors.length % CONTRIBUTOR_COLORS.length
          ]!,
        joinedAt: at,
      };
      state.contributors.push(next);
      people.set(profile.id, next);
    }
    if (!player) {
      player = {
        id: profile.id,
        firstSeenAt: at,
        lastSeenAt: at,
        blocked: false,
        coins: 0,
        xp: 0,
        reputation: 0,
        presenceSeconds: 0,
        rewardedMinutes: 0,
        rewardClaims: [],
      };
      state.population.players.push(player);
      players.set(profile.id, player);
    }
    player.lastSeenAt = at;
  }
  return omitted;
}
