import { expect, it } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import { exampleCleanupPlan } from "../../../features/coforge/application/example-cleanup-plan";
import { removeExampleState } from "../../../features/coforge/application/example-cleanup-state";
import {
  defaultEconomyDefinition,
  type EconomyReservationPort,
  type EconomyUsageReservation,
} from "../../../features/coforge/domain/command-economy";
import { emptyStore } from "./memory-storage";
it("removes proven simulator receipts/perks and balance effects, preserves real/ambiguous ownership, and cannot reroll after cleanup", async () => {
  const { store } = await emptyStore();
  let draws = 0;
  const receipts = new Map<string, EconomyUsageReservation>();
  const port: EconomyReservationPort = {
    async reserve(key, _identity, prepare) {
      const prior = receipts.get(key);
      if (prior) return structuredClone(prior);
      const receipt = prepare(() => {
        draws++;
        return 0;
      });
      receipts.set(key, receipt);
      return structuredClone(receipt);
    },
  };
  await store.transaction((state) => {
    const definition = defaultEconomyDefinition();
    definition.commandRules.help.benefits = { coins: 8, xp: 3, reputation: 2 };
    definition.commandRules.help.lootboxIds = ["box"];
    definition.rewards = [
      {
        id: "perk",
        name: "Song choice",
        kind: "perk",
        cost: 1,
        description: "Manual song choice.",
      },
    ];
    definition.lootboxes = [
      {
        id: "box",
        name: "Example draw",
        cost: 0,
        entries: [{ rewardId: "perk", weight: 1 }],
      },
    ];
    state.population.economy = {
      configurationRevision: 1,
      definition,
      usages: [],
      usageTombstones: {},
      redemptions: [],
      droppedUsages: 0,
    };
  });
  const input = {
    username: "Local tester",
    source: "simulator" as const,
    text: "!help",
    messageId: "local-help",
  };
  await ingestChat(store, input, port);
  await ingestChat(
    store,
    {
      username: "Live viewer",
      source: "twitch",
      userId: "99",
      text: "!help",
      messageId: "live-help",
    },
    port,
  );
  // A manually authored request keeps this local profile, so the captured net effects are reversed in place.
  await store.transaction((state) => {
    const id = state.population.players.find((player) =>
      player.id.startsWith("simulator:"),
    )!.id;
    state.ideas.push({
      id: "CF-001",
      number: 1,
      projectId: state.activeProjectId,
      title: "Manually authored canonical item",
      description: "Keep this authored request.",
      authorId: id,
      category: "gameplay",
      status: "inbox",
      voters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    (state.requestOrigins ??= {})["CF-001"] = "manual";
    state.nextIdeaNumber = 2;
  });
  const preview = exampleCleanupPlan(store.internalSnapshot());
  expect(preview).toMatchObject({ economyUsageCount: 1, economyPerkCount: 1 });
  await store.transaction((state) => {
    removeExampleState(state, []);
  });
  const population = store.snapshot().population!;
  expect(population.economy!.usages).toMatchObject([{ source: "twitch" }]);
  expect(population.economy!.redemptions).toMatchObject([{ source: "twitch" }]);
  expect(
    population.players.find((player) => player.id.startsWith("simulator:")),
  ).toMatchObject({ coins: 0, xp: 0, reputation: 0 });
  expect(store.snapshot().ideas).toHaveLength(1);
  expect(await ingestChat(store, input, port)).toMatchObject({
    duplicate: true,
  });
  expect(draws).toBe(2);
  expect(store.snapshot().population!.economy!.redemptions).toHaveLength(1);
  expect(
    store.snapshot().population!.economy!.usageTombstones[
      "simulator:local-help"
    ],
  ).toMatchObject({ outcome: "committed" });
});

it("aggregates simulator credit and spending reversals before clamping a retained profile", async () => {
  const { store } = await emptyStore();
  await store.transaction((state) => {
    const definition = defaultEconomyDefinition();
    definition.commandRules.help.benefits.coins = 10;
    definition.rewards = [
      {
        id: "song",
        name: "Song",
        kind: "perk",
        cost: 5,
        description: "Manual song.",
      },
    ];
    state.population.economy = {
      configurationRevision: 1,
      definition,
      usages: [],
      redemptions: [],
      usageTombstones: {},
      droppedUsages: 0,
    };
  });
  const viewer = { username: "Local", source: "simulator" as const };
  await ingestChat(store, { ...viewer, text: "!help" });
  await ingestChat(store, { ...viewer, text: "!redeem song" });
  expect(store.snapshot().population!.players[0]?.coins).toBe(5);
  await store.transaction((state) => {
    // Keep a canonical manually authored request and its profile while removing test receipts.
    state.ideas.push({
      id: "CF-001",
      number: 1,
      projectId: state.activeProjectId,
      title: "Keep this manually authored request",
      description: "Canonical authored context.",
      authorId: "simulator:local",
      category: "gameplay",
      status: "inbox",
      voters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    (state.requestOrigins ??= {})["CF-001"] = "manual";
    state.nextIdeaNumber = 2;
    removeExampleState(state, []);
  });
  expect(store.snapshot().population!.players[0]?.coins).toBe(0);
  expect(store.snapshot().population!.economy!.usages).toHaveLength(0);
  expect(store.snapshot().population!.economy!.redemptions).toHaveLength(0);
});
