import { expect, it } from "vitest";
import { ingestChat } from "../../../features/coforge/application/chat";
import {
  defaultEconomyDefinition,
  type EconomyReservationPort,
} from "../../../features/coforge/domain/command-economy";
import { emptyStore } from "./memory-storage";
import { parseCommand } from "../../../features/coforge/domain/commands";
it("delivers complete saved prices and effective odds on every page with maximum-length labels, IDs, currency, and settlement benefits", async () => {
  const { store } = await emptyStore();
  const ids = [1, 2, 3, 4].map((index) => `r${index}${"x".repeat(98)}`);
  const boxId = `b${"x".repeat(99)}`;
  const viewer = {
    username: "River",
    userId: "99",
    source: "twitch" as const,
    channelId: "123",
  };
  await ingestChat(store, {
    username: viewer.username,
    userId: viewer.userId,
    source: viewer.source,
    text: "Hello",
  });
  await store.transaction((state) => {
    state.integration.twitchEnabled = true;
    state.integration.twitchBroadcasterId = "123";
    state.integration.twitchBotReplies = true;
    state.population.environment.currencyName = "c".repeat(40);
    state.population.players[0]!.coins = 100;
    const definition = defaultEconomyDefinition();
    definition.rewards = ids.map((id) => ({
      id,
      name: "N".repeat(100),
      kind: "virtual",
      cost: 100000,
      coins: 1,
      xp: 1,
      reputation: 1,
    }));
    definition.lootboxes = [
      {
        id: boxId,
        name: "B".repeat(100),
        cost: 100000,
        entries: ids.map((rewardId) => ({ rewardId, weight: 100000 })),
      },
    ];
    definition.commandRules.redeem.cost = 100000;
    definition.commandRules.lootbox.cost = 100000;
    for (const type of ["shop", "odds"] as const) {
      definition.commandRules[type].cost = 1;
      definition.commandRules[type].benefits.coins = 1;
      definition.commandRules[type].lootboxIds = [boxId];
    }
    state.population.economy = {
      configurationRevision: 1,
      definition,
      usages: [],
      usageTombstones: {},
      redemptions: [],
      droppedUsages: 0,
    };
  });
  const reservations: EconomyReservationPort = {
    async reserve(_key, _identity, prepare) {
      return prepare(() => 0);
    },
  };
  const readAll = async (type: "shop" | "odds") => {
    const results: string[] = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const command =
        type === "shop" ? `!shop ${page}` : `!odds ${boxId} ${page}`;
      expect(parseCommand(command).type).toBe(type);
      const result = await ingestChat(
        store,
        { ...viewer, text: command, messageId: `${type}-${page}` },
        reservations,
      );
      expect(result.ok).toBe(true);
      pages = Number(/^(?:Shop|Odds) \d+\/(\d+):/.exec(result.message)?.[1]);
      expect(pages).toBeGreaterThan(0);
      expect([...result.message].length).toBeLessThanOrEqual(500);
      expect(store.snapshot().botReplies!.at(-1)!.text).toBe(result.message);
      expect(result.message).not.toContain("�");
      if (type === "odds")
        expect(result.message).toContain("Purchase total: 200000");
      else
        expect(result.message).toContain("Prices include item + command fee.");
      if (page < pages)
        expect(result.message).toContain(
          type === "shop"
            ? `Next: !shop ${page + 1}`
            : `Next: !odds ${boxId} ${page + 1}`,
        );
      results.push(result.message);
    }
    return results.join(" ");
  };
  const shop = await readAll("shop");
  expect(shop).toContain(`!lootbox ${boxId}`);
  for (const id of ids) expect(shop).toContain(`!redeem ${id}`);
  const odds = await readAll("odds");
  for (const id of ids)
    expect(odds).toContain(`${id} NNNNNNNNNNN…: 100000/400000 (25.00%)`);
  expect(parseCommand(`!odds ${boxId} 100`)).toMatchObject({
    type: "odds",
    page: 100,
  });
});
