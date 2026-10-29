import { describe, expect, it } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import {
  defaultEconomyDefinition,
  type EconomyReservationPort,
  type EconomyUsageReservation,
} from "../../../features/coforge/domain/command-economy";
import { emptyStore } from "./memory-storage";
import {
  economyDefinitionCheck,
  economyUsageReservationCheck,
} from "../../../features/coforge/domain/command-economy-check";
const viewer = {
  username: "River",
  source: "simulator" as const,
  userId: "river",
};
function reservationPort() {
  const receipts = new Map<string, EconomyUsageReservation>();
  let draws = 0;
  const port: EconomyReservationPort = {
    async reserve(key, identity, prepare) {
      const prior = receipts.get(key);
      if (prior) {
        if (prior.inputIdentity !== identity)
          throw new Error("identity conflict");
        return structuredClone(prior);
      }
      const receipt = prepare((max) => {
        draws++;
        return max - 1;
      });
      receipts.set(key, economyUsageReservationCheck(receipt));
      return structuredClone(receipt);
    },
  };
  return { port, draws: () => draws };
}
async function configured() {
  const kit = await emptyStore();
  await kit.store.transaction((state) => {
    const definition = defaultEconomyDefinition();
    definition.commandRules.register.cost = 2;
    definition.commandRules.register.benefits.xp = 3;
    definition.commandRules.request.cost = 4;
    definition.rewards = [
      {
        id: "coin",
        name: "Coins",
        kind: "virtual",
        cost: 5,
        coins: 7,
        xp: 0,
        reputation: 0,
      },
      {
        id: "song",
        name: "Choose a song",
        kind: "perk",
        cost: 3,
        description: "Streamer chooses an appropriate requested song.",
      },
    ];
    definition.lootboxes = [
      {
        id: "box",
        name: "Tiny box",
        cost: 6,
        entries: [
          { rewardId: "coin", weight: 1 },
          { rewardId: "song", weight: 3 },
        ],
      },
    ];
    state.population.economy = {
      definition,
      configurationRevision: 1,
      usages: [],
      usageTombstones: {},
      redemptions: [],
      droppedUsages: 0,
    };
  });
  return kit;
}
describe("command Economy settlement", () => {
  it("allows zero fees, charges registration without giving initial credits, and does not reward semantic repeats", async () => {
    const { store } = await configured();
    expect(
      await ingestChat(store, {
        ...viewer,
        text: "!register",
        messageId: "poor",
      }),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("Insufficient"),
    });
    expect(
      store.snapshot().population!.players[0]?.registeredAt,
    ).toBeUndefined();
    await store.transaction((state) => {
      state.population.players[0]!.coins = 8;
    });
    expect(
      await ingestChat(store, {
        ...viewer,
        text: "!register",
        messageId: "joined",
      }),
    ).toMatchObject({ ok: true });
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 6,
      xp: 3,
    });
    expect(
      await ingestChat(store, {
        ...viewer,
        text: "!register",
        messageId: "again",
      }),
    ).toMatchObject({ ok: true, duplicate: true });
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 6,
      xp: 3,
    });
    expect(store.snapshot().population!.economy!.usages).toHaveLength(1);
  });
  it("rolls back unaffordable note creation and rejects a private public target before fees or draws", async () => {
    const { store } = await configured();
    await store.transaction((state) => {
      state.population.economy!.definition.commandRules.register.cost = 0;
    });
    await ingestChat(store, { ...viewer, text: "!register" });
    expect(
      await ingestChat(store, {
        ...viewer,
        text: "!request CFP-001 Add a forest bridge",
        messageId: "request",
      }),
    ).toMatchObject({ ok: false });
    expect(store.snapshot().ideas).toHaveLength(0);
    expect(store.snapshot().nextIdeaNumber).toBe(1);
    await store.transaction((state) => {
      state.projects[0]!.visibility = "private";
    });
    const reservations = reservationPort();
    expect(
      await ingestChat(
        store,
        {
          username: "Viewer",
          userId: "42",
          source: "twitch",
          text: "!request CFP-001 Add a forest bridge",
          messageId: "private",
        },
        reservations.port,
      ),
    ).toMatchObject({
      ok: false,
      message: "This project or request is unavailable.",
    });
    expect(reservations.draws()).toBe(0);
  });
  it("freezes one weighted purchase across proven storage rollback and grants its manual perk exactly once", async () => {
    const { store, storage } = await configured();
    const reservations = reservationPort();
    await ingestChat(store, { ...viewer, text: "Hello" });
    await store.transaction((state) => {
      state.population.players[0]!.coins = 20;
      state.population.economy!.definition.commandRules.lootbox.cost = 2;
    });
    const input = { ...viewer, text: "!lootbox box", messageId: "open" };
    storage.failNextSave = true;
    await expect(ingestChat(store, input, reservations.port)).rejects.toThrow(
      "Disk full",
    );
    expect(store.snapshot().population!.players[0]?.coins).toBe(20);
    expect(store.snapshot().population!.economy!.redemptions).toHaveLength(0);
    await store.transaction((state) => {
      state.population.economy!.definition.lootboxes = [];
      state.population.economy!.definition.rewards = [];
    });
    expect(await ingestChat(store, input, reservations.port)).toMatchObject({
      ok: true,
    });
    expect(reservations.draws()).toBe(1);
    expect(store.snapshot().population!.players[0]?.coins).toBe(12);
    expect(store.snapshot().population!.economy!.redemptions).toMatchObject([
      { rewardId: "song", status: "pending" },
    ]);
    expect(await ingestChat(store, input, reservations.port)).toMatchObject({
      duplicate: true,
    });
    expect(store.snapshot().population!.economy!.redemptions).toHaveLength(1);
  });
  it("publishes additive prices and aggregate effective odds without drawing", async () => {
    const { store } = await configured();
    await store.transaction((state) => {
      const economy = state.population.economy!;
      economy.definition.commandRules.lootbox.cost = 2;
      economy.definition.lootboxes[0]!.entries.push({
        rewardId: "song",
        weight: 1,
      });
    });
    const reservations = reservationPort();
    expect(
      (await ingestChat(store, { ...viewer, text: "!shop" }, reservations.port))
        .message,
    ).toContain("Prices include item + command fee");
    expect(
      (
        await ingestChat(
          store,
          { ...viewer, text: "!odds box" },
          reservations.port,
        )
      ).message,
    ).toContain("4/5 (80.00%)");
    expect(reservations.draws()).toBe(0);
  });
  it("rejects invalid catalog references and zero-total lootboxes at the configuration boundary", () => {
    const definition = defaultEconomyDefinition();
    definition.commandRules.help.rewardIds = ["missing"];
    expect(() => economyDefinitionCheck(definition)).toThrow("unknown reward");
    definition.commandRules.help.rewardIds = [];
    definition.rewards = [
      {
        id: "a",
        name: "A",
        kind: "virtual",
        cost: 0,
        coins: 1,
        xp: 0,
        reputation: 0,
      },
    ];
    definition.lootboxes = [
      {
        id: "empty",
        name: "Empty",
        cost: 0,
        entries: [{ rewardId: "a", weight: 0 }],
      },
    ];
    expect(() => economyDefinitionCheck(definition)).toThrow("positive");
  });
});
