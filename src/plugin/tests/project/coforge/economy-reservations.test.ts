import { defaultEconomyDefinition } from "../../../features/coforge/domain/command-economy";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { shape, text, number } from "../../../features/coforge/domain/check";
import { VaultEconomyReservations } from "../../../infrastructure/coforge/economy-reservations";
import { atomicCommandFixture } from "./atomic-command-fixture";
import { createIdea } from "../../../features/coforge/application/chat";
const check = shape(
  {
    eventKey: text(),
    inputIdentity: text(),
    ticket: number({ integer: true, min: 0 }),
    revision: number({ integer: true, min: 0 }),
  },
  { strict: true },
);
const prepare =
  (eventKey: string, inputIdentity = "captured command", revision = 1) =>
  (draw: (max: number) => number) => ({
    eventKey,
    inputIdentity,
    ticket: draw(100),
    revision,
  });

it("reuses an immutable private draw across reload, duplicate delivery and later configuration changes", async () => {
  const f = await atomicCommandFixture();
  const draw = vi.fn(() => 73);
  const port = new VaultEconomyReservations(f.plugin, check, draw);
  try {
    const first = await port.reserve(
      "twitch:channel:message",
      "captured command",
      prepare("twitch:channel:message"),
    );
    expect(
      await port.reserve(
        "twitch:channel:message",
        "captured command",
        prepare("twitch:channel:message", "captured command", 2),
      ),
    ).toEqual(first);
    const replacementDraw = vi.fn(() => 5);
    const reloaded = new VaultEconomyReservations(
      f.plugin,
      check,
      replacementDraw,
    );
    await reloaded.validate();
    expect(
      await reloaded.reserve(
        "twitch:channel:message",
        "captured command",
        prepare("twitch:channel:message"),
      ),
    ).toEqual(first);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(replacementDraw).not.toHaveBeenCalled();
    expect((await f.app.vault.adapter.list(port.directory)).files[0]).toMatch(
      /\/[a-f0-9]{64}\.json$/u,
    );
    expect(
      f.kit.read(`${f.app.vault.configDir}/plugins/coforge/.gitignore`),
    ).toContain("coforge-economy-reservations/");
    await expect(
      port.reserve(
        "twitch:channel:message",
        "changed command",
        prepare("twitch:channel:message", "changed command"),
      ),
    ).rejects.toThrow(/different input/i);
  } finally {
    await f.studio.stop();
  }
});

it("reuses the frozen outcome after a confirmed note/ledger rollback and grants nothing before commit", async () => {
  const f = await atomicCommandFixture();
  const draw = vi.fn(() => 61);
  const port = new VaultEconomyReservations(f.plugin, check, draw);
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, bytes) => {
      if (path === f.storage.dataPath) throw new Error("Data unavailable");
      await write(path, bytes);
    },
  );
  const command = () =>
    f.studio.store.transaction(
      async (state) => {
        const reserved = await port.reserve(
          "paid-source",
          "captured command",
          prepare("paid-source"),
        );
        const idea = createIdea(state, {
          username: "Owner",
          title: "A paid request",
          description: "A request with a frozen reward draw.",
        });
        state.ingestMeta.processedMessages.push({
          id: `ticket-${reserved.ticket}`,
          ideaId: idea.id,
        });
        return reserved;
      },
      { atomicCommand: true },
    );
  try {
    await expect(command()).rejects.toThrow("Data unavailable");
    expect(f.studio.state().ideas).toHaveLength(0);
    expect(
      f.studio.store.internalSnapshot().ingestMeta.processedMessages,
    ).toHaveLength(0);
    vi.restoreAllMocks();
    expect((await command()).ticket).toBe(61);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(f.studio.state().ideas).toHaveLength(1);
    expect(f.kit.read(f.storage.dataPath)).toContain("ticket-61");
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("accepts reservation write-then-throw exactly once and holds malformed evidence before any further draw", async () => {
  const f = await atomicCommandFixture();
  const draw = vi.fn(() => 7);
  const port = new VaultEconomyReservations(f.plugin, check, draw);
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(
    async (path, bytes) => {
      await write(path, bytes);
      if (path.startsWith(port.directory + "/"))
        throw new Error("Wrote then failed");
    },
  );
  try {
    expect(
      (await port.reserve("event", "captured command", prepare("event")))
        .ticket,
    ).toBe(7);
    expect(draw).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
    const file = (await f.app.vault.adapter.list(port.directory)).files[0]!;
    await f.app.vault.adapter.write(file, "{partial");
    const reloadedDraw = vi.fn(() => 1);
    const reloaded = new VaultEconomyReservations(
      f.plugin,
      check,
      reloadedDraw,
    );
    await expect(reloaded.validate()).rejects.toThrow(
      /reservation needs recovery/i,
    );
    await expect(
      reloaded.reserve("new-event", "captured command", prepare("new-event")),
    ).rejects.toThrow(/reservation needs recovery/i);
    expect(reloadedDraw).not.toHaveBeenCalled();
    expect(f.kit.read(file)).toBe("{partial");
  } finally {
    vi.restoreAllMocks();
    await f.studio.stop();
  }
});

it("roundtrips the real typed runtime receipt before loading canonical state, without granting any reward", async () => {
  const f = await atomicCommandFixture();
  const definition = defaultEconomyDefinition();
  const reward = { id: "small-bonus", name: "Small bonus", kind: "virtual" as const, cost: 0, coins: 2, xp: 1, reputation: 0 };
  definition.rewards.push(reward);
  definition.lootboxes.push({ id: "box", name: "Bonus box", cost: 0, entries: [{ rewardId: reward.id, weight: 3 }] });
  definition.commandRules.register.lootboxIds.push("box");
  try {
    const inputIdentity = JSON.stringify(["simulator", "actor", { type: "register" }]);
    const receipt = await f.storage.economyReservations.reserve("typed-event", inputIdentity, draw => {
      const now = new Date().toISOString(); const ticket = draw(3);
      return { format: "coforge-economy-reservation/v1", eventKey: "typed-event", inputIdentity, definition, configurationRevision: 1,
        usage: { id: "typed-event", eventKey: "typed-event", playerId: "simulator:actor", source: "simulator", command: "register", createdAt: now, configurationRevision: 1,
          cost: 0, commandCost: 0, purchaseCost: 0, benefits: { coins: 0, xp: 0, reputation: 0 }, awards: [{ reward, acquisition: "lootbox", lootboxId: "box" }],
          rolls: [{ lootboxId: "box", lootboxName: "Bonus box", ticket, totalWeight: 3, entries: [{ rewardId: reward.id, weight: 3 }], reward }] } };
    });
    const reloaded = new (await import("../../../infrastructure/coforge/vault-storage")).VaultStudioStorage(f.plugin);
    await reloaded.load();
    const prepareAgain = vi.fn(() => receipt);
    expect(await reloaded.economyReservations.reserve("typed-event", inputIdentity, prepareAgain)).toEqual(receipt);
    expect(prepareAgain).not.toHaveBeenCalled();
    expect(f.studio.state().population?.players).toHaveLength(0);
    expect(f.studio.state().population?.economy?.usages ?? []).toHaveLength(0);
  } finally { await f.studio.stop(); }
});
