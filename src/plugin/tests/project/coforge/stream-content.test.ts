import { expect, it } from "vitest";
import { createSeed } from "../../../features/coforge/domain/seed";
import { emptyPopulation } from "../../../features/coforge/domain/population";
import { streamSurfaceSnapshot } from "../../../features/coforge/domain/stream-surfaces";

it("adds public request scores, totals and game participation rules without private profile fields", () => {
  const state = createSeed();
  state.population = emptyPopulation();
  state.population.environment.currencyName = "crowns";
  state.population.environment.ranks = [
    { name: "Agent", minimumXp: 0 },
    { name: "Builder", minimumXp: 100 },
  ];
  Object.assign(state.population, {
    crm: "PRIVATE_CRM",
    finance: "PRIVATE_FINANCE",
  });
  const snapshot = streamSurfaceSnapshot(state, {
    channelId: "channel",
    liveSince: 0,
  });
  expect(snapshot.board.screenedRequests).toBe(
    snapshot.board.columns.reduce((sum, column) => sum + column.count, 0),
  );
  expect(snapshot.board.awaitingScreening).toBeGreaterThan(0);
  const ranked = snapshot.board.columns
    .flatMap((column) => column.ideas)
    .find((idea) => idea.id === "CF-101");
  expect(ranked?.rice).toBe(
    state.ideas.find((idea) => idea.id === "CF-101")?.rice?.score,
  );
  expect(snapshot.community.currencyName).toBe("crowns");
  expect(snapshot.community.ranks).toEqual([
    { name: "Agent", minimumXp: 0 },
    { name: "Builder", minimumXp: 100 },
  ]);
  expect(snapshot.community.rules.coinsPerMinute).toBe(1);
  expect(JSON.stringify(snapshot)).not.toContain("PRIVATE_");
  expect(Object.keys(snapshot.community)).not.toContain("players");
});
