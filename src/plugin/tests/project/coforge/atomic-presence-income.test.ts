import { ingestChat } from "../../../features/coforge/application/chat";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { creditPresence } from "../../../features/coforge/application/economy";
import { observePlayer, registerPlayer } from "../../../features/coforge/application/population";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { atomicCommandFixture } from "./atomic-command-fixture";

it.each([30, 60])("retains a real %s-second presence sample once when the data write commits then throws", async seconds => {
  const f = await atomicCommandFixture(); const to = Date.now(); const from = to - seconds * 1000;
  await f.studio.store.transaction(state => { state.integration.twitchBroadcasterId = "123"; });
  await f.studio.store.transaction(state => {
    observePlayer(state, "twitch:91", new Date(from - 1000).toISOString());
    registerPlayer(state, "twitch:91", new Date(from - 1000).toISOString());
  });
  const sample = { id: `123:stream:sample-${seconds}`, channelId: "123", from, to, playerIds: ["twitch:91"] };
  const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  let preparedJournal = "";
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(async (path, bytes) => {
    if (path.endsWith("coforge-command-commit.json")) preparedJournal = bytes;
    await write(path, bytes); if (path === f.storage.dataPath) throw new Error("Presence data wrote then threw");
  });
  try {
    await expect(f.studio.store.transaction(state => creditPresence(state, sample))).resolves.toBeUndefined();
    const player = f.studio.state().population!.players.find(player => player.id === "twitch:91")!;
    expect(player).toMatchObject({ presenceSeconds: seconds, registeredPresenceSeconds: seconds,
      rewardedMinutes: Math.floor(seconds / 60), rewardedXpMinutes: Math.floor(seconds / 60), coins: Math.floor(seconds / 60), xp: Math.floor(seconds / 60) });
    vi.restoreAllMocks();
    expect(preparedJournal).not.toBe("");
    const journalPath = f.storage.dataPath.replace("coforge-state.json", "coforge-command-commit.json");
    // Recreate the exact durable phase left by a process crash after data commit but before receipt cleanup.
    await f.app.vault.adapter.write(journalPath, preparedJournal);
    const recovered = await new VaultStudioStorage(f.plugin).load();
    expect(recovered.data?.population?.players.find(player => player.id === "twitch:91")?.presenceSeconds).toBe(seconds);
    expect(await f.app.vault.adapter.exists(journalPath)).toBe(false);
    await f.studio.store.transaction(state => { state.population.counters['message-observed'] = 1; });
    const loaded = await new VaultStudioStorage(f.plugin).load();
    expect(loaded.data?.population?.players.find(player => player.id === "twitch:91")).toMatchObject({ presenceSeconds: seconds, coins: Math.floor(seconds / 60), xp: Math.floor(seconds / 60) });
    expect(loaded.data?.population?.presenceSamples.filter(id => id === sample.id)).toHaveLength(1);
    await f.studio.store.transaction(state => creditPresence(state, sample));
    expect(f.studio.state().population!.players.find(player => player.id === "twitch:91")?.presenceSeconds).toBe(seconds);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it("commits ordinary earning-rule changes after a data write-then-throw without a command flag", async () => {
  const f = await atomicCommandFixture(); const write = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  vi.spyOn(f.app.vault.adapter, "write").mockImplementation(async (path, bytes) => { await write(path, bytes); if (path === f.storage.dataPath) throw new Error("Rules wrote then threw"); });
  try {
    await f.studio.store.transaction(state => { state.population.rules.coinsPerMinute = 7; });
    expect(f.studio.state().population?.rules.coinsPerMinute).toBe(7);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it("does not journal ordinary chatter or last-seen-only profile observations", async () => {
  const f = await atomicCommandFixture(); const write = vi.spyOn(f.app.vault.adapter, "write");
  try {
    await ingestChat(f.studio.store, { username: "Viewer", userId: "viewer", source: "simulator", text: "An ordinary chat message" });
    await ingestChat(f.studio.store, { username: "Viewer", userId: "viewer", source: "simulator", text: "Another ordinary chat message" });
    expect(write.mock.calls.some(([path]) => path.endsWith("coforge-command-commit.json"))).toBe(false);
    expect(f.studio.state().population?.players).toHaveLength(1);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});
