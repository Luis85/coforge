import { list, number, shape, text } from "./check";
import { cleanLine } from "./sanitize";
export interface NamedRank {
  name: string;
  minimumXp: number;
}
export interface CommunityEnvironment {
  actorName: string;
  currencyName: string;
  ranks: NamedRank[];
}
export const defaultCommunityEnvironment = (): CommunityEnvironment => ({
  actorName: "Agent",
  currencyName: "gold",
  ranks: [{ name: "Agent", minimumXp: 0 }],
});
const environment = shape(
  {
    actorName: text({ trim: true, min: 1, max: 40 }),
    currencyName: text({ trim: true, min: 1, max: 40 }),
    ranks: list(
      shape(
        {
          name: text({ trim: true, min: 1, max: 40 }),
          minimumXp: number({ integer: true, min: 0, max: 1_000_000_000 }),
        },
        { strict: true },
      ),
    ),
  },
  { strict: true },
);
export function communityEnvironmentCheck(value: unknown): CommunityEnvironment {
  const input = environment(value);
  const actorName = cleanLine(input.actorName, 40);
  const currencyName = cleanLine(input.currencyName, 40);
  const ranks = input.ranks
    .map((rank) => ({ ...rank, name: cleanLine(rank.name, 40) }))
    .sort((a, b) => a.minimumXp - b.minimumXp);
  if (
    !actorName ||
    !currencyName ||
    !ranks.length ||
    ranks.length > 100 ||
    ranks[0]?.minimumXp !== 0 ||
    ranks.some((rank) => !rank.name)
  )
    throw new Error("Set actor and currency names, and 1–100 named ranks starting at 0 XP.");
  if (
    new Set(ranks.map((rank) => rank.minimumXp)).size !== ranks.length ||
    new Set(ranks.map((rank) => rank.name.toLocaleLowerCase("en-US"))).size !== ranks.length
  )
    throw new Error("Each rank needs a unique name and a unique minimum XP threshold.");
  return { actorName, currencyName, ranks };
}
export function achievedRank(
  xp: number,
  environment: CommunityEnvironment,
): NamedRank & { position: number; next?: NamedRank } {
  let position = 0;
  for (let index = 0; index < environment.ranks.length; index++)
    if (xp >= environment.ranks[index]!.minimumXp) position = index;
  return {
    ...(environment.ranks[position] ?? { name: "Agent", minimumXp: 0 }),
    position: position + 1,
    ...(environment.ranks[position + 1] ? { next: environment.ranks[position + 1]! } : {}),
  };
}
