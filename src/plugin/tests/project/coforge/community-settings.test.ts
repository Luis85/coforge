import { describe, expect, it } from "vitest";
import { achievedRank, communityEnvironmentCheck } from "../../../features/coforge/domain/community-environment";
import { updateCommunitySettings } from "../../../features/coforge/application/population";
import { defaultEconomyRules } from "../../../features/coforge/domain/population";
import { emptyStore, registerTestViewers } from "./memory-storage";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import { ingestChat } from "../../../features/coforge/application/chat";
describe("community environment and rank ladder", () => {
  it("defaults to Agent and gold; saves named XP thresholds without changing player balances", async () => {
    const { store, storage } = await emptyStore();
    expect(store.snapshot().population?.environment).toMatchObject({ actorName: "Agent", currencyName: "gold" });
    await registerTestViewers(store, [{ username: "Viewer" }]);
    await store.transaction((state) => {
      state.population.players[0]!.coins = 42;
      state.population.players[0]!.xp = 125;
      updateCommunitySettings(state, {
        environment: {
          actorName: "Citizen",
          currencyName: "credits",
          ranks: [
            { name: "Builder", minimumXp: 100 },
            { name: "Resident", minimumXp: 0 },
            { name: "Architect", minimumXp: 500 },
          ],
        },
        rules: defaultEconomyRules(),
      });
    });
    const restarted = new StudioStore(storage);
    await restarted.init();
    const population = restarted.snapshot().population!;
    expect(population.players[0]).toMatchObject({ coins: 42, xp: 125 });
    expect(achievedRank(125, population.environment)).toMatchObject({
      name: "Builder",
      position: 2,
      next: { name: "Architect", minimumXp: 500 },
    });
    expect((await ingestChat(restarted, { username: 'Viewer', text: '!me' })).message).toContain('42 credits');
    expect((await ingestChat(restarted, { username: 'Viewer', text: '!ranks' })).message).toContain('Builder: 100 XP');
  });
  it("rejects ambiguous ladders and keeps the previous configuration on an invalid save", async () => {
    const { store } = await emptyStore();
    const before = store.snapshot().population?.environment;
    for (const ranks of [
      [{ name: "Builder", minimumXp: 100 }],
      [
        { name: "Agent", minimumXp: 0 },
        { name: "AGENT", minimumXp: 100 },
      ],
      [
        { name: "Agent", minimumXp: 0 },
        { name: "Builder", minimumXp: 0 },
      ],
    ]) {
      expect(() => communityEnvironmentCheck({ actorName: "Agent", currencyName: "gold", ranks })).toThrow();
      await expect(
        store.transaction((state) =>
          updateCommunitySettings(state, {
            environment: { actorName: "New name", currencyName: "credits", ranks },
            rules: defaultEconomyRules(),
          }),
        ),
      ).rejects.toThrow();
    }
    expect(store.snapshot().population?.environment).toEqual(before);
  });
});
