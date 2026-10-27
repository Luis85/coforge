import type { AppState } from "./types";
import {
  achievedRank,
  defaultCommunityEnvironment,
} from "./community-environment";
export interface ViewerNote {
  id: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  registeredAt?: string;
  xp: number;
  coins: number;
  currency: string;
  reputation: number;
  presenceSeconds: number;
  rank: string;
  blocked: boolean;
  banned: boolean;
  mutedUntil?: string;
}
export function viewerNoteProfiles(
  state: Pick<AppState, "population" | "contributors">,
  ids?: ReadonlySet<string>,
): ViewerNote[] {
  const names = new Map(
    state.contributors.map((person) => [person.id, person.name]),
  );
  const environment =
    state.population?.environment ?? defaultCommunityEnvironment();
  return (state.population?.players ?? [])
    .filter(
      (player) =>
        /^twitch:\d+$/.test(player.id) && (!ids || ids.has(player.id)),
    )
    .map((player) => ({
      id: player.id,
      name: names.get(player.id) ?? "Twitch viewer",
      firstSeenAt: player.firstSeenAt,
      lastSeenAt: player.lastSeenAt,
      ...(player.registeredAt ? { registeredAt: player.registeredAt } : {}),
      xp: player.xp,
      coins: player.coins,
      currency: environment.currencyName,
      reputation: player.reputation,
      presenceSeconds: player.presenceSeconds,
      rank: player.registeredAt
        ? achievedRank(player.xp, environment).name
        : "Not registered",
      blocked: player.blocked,
      banned: Boolean(player.restriction?.banned),
      ...(player.restriction?.expiresAt
        ? { mutedUntil: player.restriction.expiresAt }
        : {}),
    }));
}
