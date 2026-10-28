import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { registerPlayer } from "../../../features/coforge/application/population";
import { atomicExistingFixture } from "./atomic-command-fixture";
import { defaultEconomyDefinition } from "../../../features/coforge/domain/command-economy";
import { needsAtomicCommand } from "../../../infrastructure/coforge/atomic-command-plan";

it.each(["screened", "shipped"] as const)("automatically rolls back the %s note and its contribution award on failed data commit", async status => {
  const f = await atomicExistingFixture();
  await f.studio.store.transaction(state => { registerPlayer(state, f.idea.authorId); });
  const note = f.kit.read(f.file.path); const before = JSON.stringify(f.studio.state().population);
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(async (path, bytes) => {
    if (path === f.storage.dataPath) throw new Error("Data unavailable"); await write(path, bytes);
  });
  try {
    await expect(f.studio.store.transaction(state => {
      const idea = state.ideas.find(item => item.id === f.idea.id)!;
      idea.status = status;
      idea.screening = { verdict: "clear", reason: "Screened ordinary request", signals: [], checkedAt: new Date().toISOString(), provider: "demo" };
    })).rejects.toThrow("Data unavailable");
    expect(f.kit.read(f.file.path)).toBe(note);
    expect(JSON.stringify(f.studio.state().population)).toBe(before);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it("recognizes committed Economy config after a data write-then-throw without an explicit command flag", async () => {
  const f = await atomicExistingFixture(); const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(async (path, bytes) => { await write(path, bytes); if (path === f.storage.dataPath) throw new Error("Wrote then threw"); });
  try {
    await f.studio.store.transaction(state => {
      const definition = defaultEconomyDefinition(); definition.commandRules.vote.cost = 3;
      state.population.economy = { configurationRevision: 1, definition, usages: [], usageTombstones: {}, redemptions: [], droppedUsages: 0 };
    });
    expect(f.studio.state().population?.economy?.definition.commandRules.vote.cost).toBe(3);
    expect(f.kit.read(f.storage.dataPath)).toContain('"configurationRevision": 1');
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it("treats absent legacy Economy and empty defaults alike, preserving unrelated project settings saves", async () => {
  const f = await atomicExistingFixture();
  try {
    const before = f.studio.store.internalSnapshot(); const next = structuredClone(before);
    next.population.economy = { configurationRevision: 0, definition: defaultEconomyDefinition(), usages: [], usageTombstones: {}, redemptions: [], droppedUsages: 0 };
    expect(needsAtomicCommand(next, before, {})).toBe(false);
    next.projects[0]!.settings.projectBrief = "An unrelated project setting";
    expect(needsAtomicCommand(next, before, {})).toBe(false);
  } finally { await f.studio.stop(); }
});

it("recognizes a manual perk fulfillment committed before the data adapter threw", async () => {
  const f = await atomicExistingFixture();
  await f.studio.store.transaction(state => {
    registerPlayer(state, f.idea.authorId);
    const definition = defaultEconomyDefinition();
    const reward = { id: "perk", name: "Name a character", kind: "perk" as const, cost: 0, description: "The streamer chooses when to fulfill this manually." };
    definition.rewards.push(reward); definition.commandRules.register.rewardIds.push(reward.id);
    const now = new Date().toISOString();
    state.population.economy = { configurationRevision: 1, definition,
      usages: [{ id: "usage-one", eventKey: "event-one", playerId: f.idea.authorId, source: "simulator", command: "register", createdAt: now, configurationRevision: 1, cost: 0, commandCost: 0, purchaseCost: 0, benefits: { coins: 0, xp: 0, reputation: 0 }, awards: [{ reward, acquisition: "command-bonus" }], rolls: [] }],
      usageTombstones: { "event-one": { outcome: "committed", at: now, usageId: "usage-one" } }, droppedUsages: 0,
      redemptions: [{ id: "perk-one", usageId: "usage-one", playerId: f.idea.authorId, source: "simulator", rewardId: reward.id, rewardName: reward.name, description: reward.description, acquisition: "command-bonus", createdAt: now, status: "pending", revision: 0 }] };
  });
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(async (path, bytes) => { await write(path, bytes); if (path === f.storage.dataPath) throw new Error("Wrote then threw"); });
  try {
    await f.studio.store.transaction(state => {
      const redemption = state.population.economy!.redemptions[0]!;
      redemption.status = "fulfilled"; redemption.revision = 1; redemption.fulfilledAt = new Date().toISOString(); redemption.fulfillmentNote = "Streamer completed the manual action.";
    });
    expect(f.studio.state().population?.economy?.redemptions).toHaveLength(1);
    expect(f.studio.state().population?.economy?.redemptions[0]?.status).toBe("fulfilled");
    expect(f.kit.read(f.storage.dataPath)).toContain("Streamer completed the manual action.");
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});
