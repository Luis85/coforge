import { describe, expect, it } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import { defaultEconomyDefinition } from "../../../features/coforge/domain/command-economy";
import { emptyStore } from "./memory-storage";
import { publicProgressVisible } from "../../../features/coforge/application/public-command-policy";
describe("Economy semantic and privacy boundaries", () => {
  it("does not charge duplicate requests/votes/context, failed commands, or registration repeats", async () => {
    const { store } = await emptyStore();
    const viewer = {
      username: "River",
      userId: "99",
      source: "twitch" as const,
    };
    await ingestChat(store, { ...viewer, text: "!register" });
    await store.transaction((state) => {
      const definition = defaultEconomyDefinition();
      for (const command of ["request", "vote", "context"] as const) {
        definition.commandRules[command].cost = 2;
        definition.commandRules[command].benefits.xp = 1;
      }
      state.population.economy = {
        configurationRevision: 1,
        definition,
        usages: [],
        redemptions: [],
        usageTombstones: {},
        droppedUsages: 0,
      };
      state.population.players[0]!.coins = 20;
    });
    await ingestChat(store, {
      ...viewer,
      text: "!request CFP-001 A bridge over the creek",
    });
    expect(
      await ingestChat(store, {
        ...viewer,
        text: "!request CFP-001 A bridge over the creek",
      }),
    ).toMatchObject({ duplicate: true });
    await ingestChat(store, { ...viewer, text: "!vote CF-001" });
    expect(
      await ingestChat(store, { ...viewer, text: "!vote CF-001" }),
    ).toMatchObject({ duplicate: true });
    await ingestChat(store, {
      ...viewer,
      text: "!context CF-001 Make the bridge accessible to every viewer",
    });
    expect(
      await ingestChat(store, {
        ...viewer,
        text: "!context CF-001 Make the bridge accessible to every viewer",
      }),
    ).toMatchObject({ duplicate: true });
    expect(
      await ingestChat(store, { ...viewer, text: "!vote CF-999" }),
    ).toMatchObject({ ok: false });
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 14,
      xp: 3,
    });
    expect(store.snapshot().population!.economy!.usages).toHaveLength(3);
    // Privacy evidence survives readable receipt trimming.
    await store.transaction((state) => {
      state.population.economy!.usages = [];
      state.projects[0]!.visibility = "private";
    });
    const state = store.internalSnapshot();
    expect(state.population.players[0]!.rewardClaims).toContain(
      "command:CF-001",
    );
    expect(publicProgressVisible(state, state.population.players[0]!)).toBe(
      false,
    );
    await store.transaction(current => { current.population.players[0]!.coins = 0; current.population.economy!.definition.commandRules.help.cost = 1; });
    expect(await ingestChat(store, { ...viewer, text: '!help' })).toMatchObject({ ok: false, message: 'This command could not be applied. Ask the streamer to review your account privately.' });
  });
  it("adds item prices to purchase fees but ignores item prices for explicitly configured usage bonuses", async () => {
    const { store } = await emptyStore();
    const viewer = { username: "Local", source: "simulator" as const };
    await ingestChat(store, { ...viewer, text: "hello" });
    await store.transaction((state) => {
      const definition = defaultEconomyDefinition();
      definition.rewards = [
        {
          id: "currency",
          name: "Currency bundle",
          kind: "virtual",
          cost: 9,
          coins: 4,
          xp: 2,
          reputation: 1,
        },
      ];
      definition.commandRules.help.rewardIds = ["currency"];
      definition.commandRules.help.cost = 1;
      definition.commandRules.redeem.cost = 2;
      state.population.economy = {
        configurationRevision: 1,
        definition,
        usages: [],
        redemptions: [],
        usageTombstones: {},
        droppedUsages: 0,
      };
      state.population.players[0]!.coins = 20;
    });
    expect(await ingestChat(store, { ...viewer, text: "!help" })).toMatchObject(
      { ok: true },
    );
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 23,
      xp: 2,
      reputation: 1,
    });
    await ingestChat(store, { ...viewer, text: "!redeem currency" });
    expect(store.snapshot().population!.players[0]).toMatchObject({
      coins: 16,
      xp: 4,
      reputation: 2,
    });
    expect(
      store.snapshot().population!.economy!.usages.map((usage) => usage.cost),
    ).toEqual([1, 11]);
  });
  it("fails closed without durable randomized storage and rejects invalid random-source tickets", async () => {
    const { store } = await emptyStore();
    const viewer = { username: "Local", source: "simulator" as const };
    await store.transaction((state) => {
      const definition = defaultEconomyDefinition();
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
          id: "b",
          name: "B",
          cost: 0,
          entries: [{ rewardId: "a", weight: 1 }],
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
    await expect(
      ingestChat(store, { ...viewer, text: "!lootbox b" }),
    ).rejects.toThrow("Durable random-reward storage");
    expect(store.snapshot().population!.players).toHaveLength(0);
    await expect(
      ingestChat(
        store,
        { ...viewer, text: "!lootbox b" },
        {
          async reserve(_key, _identity, prepare) {
            return prepare(() => 1);
          },
        },
      ),
    ).rejects.toThrow("invalid ticket");
    expect(store.snapshot().population!.economy!.usages).toHaveLength(0);
  });
});

it.each(["source", "channel", "usage-id"] as const)(
  "rejects mismatched %s in an otherwise validated durable receipt without an effect",
  async (mismatch) => {
    const { store } = await emptyStore();
    const viewer = {
      username: "River",
      userId: "99",
      source: "twitch" as const,
      channelId: "123",
      text: "!help",
      messageId: "source-proof",
    };
    await store.transaction((state) => {
      state.integration.twitchBroadcasterId = "123";
      const definition = defaultEconomyDefinition();
      definition.commandRules.help.benefits.coins = 7;
      state.population.economy = {
        definition,
        configurationRevision: 1,
        usages: [],
        usageTombstones: {},
        redemptions: [],
        droppedUsages: 0,
      };
    });
    await expect(
      ingestChat(store, viewer, {
        async reserve(_key, _identity, prepare) {
          const receipt = prepare(() => 0);
          if (mismatch === "source") receipt.usage.source = "simulator";
          if (mismatch === "channel") receipt.usage.channelId = "999";
          if (mismatch === "usage-id") receipt.usage.id = "another-event";
          return receipt;
        },
      }),
    ).rejects.toThrow("does not match this event");
    expect(store.snapshot().population!.players).toHaveLength(0);
    expect(store.snapshot().population!.economy!.usages).toHaveLength(0);
  },
);
