// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultSchedule } from "../../../infrastructure/coforge/vault-schedule";
import { VaultAICosts } from "../../../infrastructure/coforge/ai-cost-storage";
import { splitNote } from "../../../infrastructure/coforge/markdown";
import { ScheduleService } from "../../../features/coforge/application/schedule-service";
import type { ScheduledStream } from "../../../features/coforge/domain/schedule";
import { emptyStore } from "./memory-storage";
const plan: ScheduledStream = {
  id: "CFS-test",
  name: "Build night",
  startsAt: "2026-11-01T19:00:00.000Z",
  timezone: "Europe/Berlin",
  projectId: "CFP-001",
  title: "Building together",
  categoryId: "123",
  categoryName: "Game",
  tags: ["English"],
  language: "en",
  liveSceneId: "live",
  breakSceneId: "brb",
  status: "planned",
};
function fixture() {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    description: "",
    author: "",
  });
  return { plugin, kit };
}
it("round-trips schedule edits without losing a script or unrelated frontmatter and rejects stale saves", async () => {
  const { plugin, kit } = fixture();
  const storage = new VaultSchedule(plugin);
  const initial = await storage.save(plan, null);
  const file = kit.app.vault.getFileByPath("CoForge/Schedule/CFS-test.md")!;
  await kit.app.vault.process(
    file,
    (content) =>
      content.replace(
        "type: coforge-scheduled-stream",
        "custom: keep\ntype: coforge-scheduled-stream",
      ) + "\r\n## Private talking points\r\nKeep these bytes.",
  );
  await expect(
    storage.save({ ...plan, name: "Stale" }, initial.revision),
  ).rejects.toThrow("Refresh");
  const fresh = (await storage.list())[0]!;
  const updated = await storage.save(
    { ...plan, title: "New channel title", music: { liveInputId: "obs-music", breakInputId: "" } },
    fresh.revision,
  );
  expect(updated.body).toBe(fresh.body);
  expect(parseYaml(splitNote(updated.revision).yaml!)).toMatchObject({
    custom: "keep",
    plan: { id: plan.id, title: "New channel title", music: { liveInputId: "obs-music", breakInputId: "" } },
  });
  expect((await new VaultSchedule(plugin).list())[0]?.plan.title).toBe(
    "New channel title",
  );
});
it("loads legacy plans without playlist controls and preserves their old playlist and note bytes on save", async () => {
  const { plugin, kit } = fixture();
  const storage = new VaultSchedule(plugin);
  await storage.save(plan, null);
  const file = kit.app.vault.getFileByPath("CoForge/Schedule/CFS-test.md")!;
  await kit.app.vault.process(file, content => content.replace("  status:", "  playlistId: legacy-playlist\n  status:") + "\r\nLegacy script.");
  const legacy = (await storage.list())[0]!;
  expect(legacy.plan).not.toHaveProperty("playlistId");
  const updated = await storage.save({ ...legacy.plan, name: "Updated plan" }, legacy.revision);
  expect(updated.body).toBe(legacy.body);
  expect(parseYaml(splitNote(updated.revision).yaml!)).toMatchObject({ plan: { playlistId: "legacy-playlist", name: "Updated plan" } });
});
it("never prepares automatically and rejects stale/closed plans before external effects", async () => {
  const { plugin } = fixture();
  const storage = new VaultSchedule(plugin);
  const { store } = await emptyStore();
  const calls: string[] = [];
  const service = new ScheduleService(
    storage,
    {
      project: async () => {
        calls.push("project");
      },
      channel: async () => {
        calls.push("channel");
      },
      music: async () => { calls.push("music"); },
      scenes: async () => {
        calls.push("scenes");
      },
    },
    store,
  );
  const saved = await service.save(plan, null);
  expect(calls).toEqual([]);
  await service.apply(plan.id, saved.revision, "project");
  expect(calls).toEqual(["project"]);
  await service.save({ ...plan, status: "cancelled" }, saved.revision);
  await expect(
    service.apply(plan.id, saved.revision, "channel"),
  ).rejects.toThrow("changed");
  const cancelled = (await service.list())[0]!;
  await expect(
    service.apply(plan.id, cancelled.revision, "channel"),
  ).rejects.toThrow("Only planned");
  expect(calls).toEqual(["project"]);
});
it("preserves AI task costs and human annotations, rejects concurrent edits and detects a removed ledger", async () => {
  const { plugin, kit } = fixture();
  const storage = new VaultAICosts(plugin);
  await storage.load();
  const tasks = [
    {
      id: "run-1",
      featureId: "CF-101",
      featureTitle: "Feature",
      projectId: "CFP-001",
      projectName: "Game",
      provider: "claude" as const,
      stage: "build",
      status: "failed",
      startedAt: "2026-10-27T10:00:00.000Z",
      reportedUsd: 0.125,
      usage: {
        inputTokens: 12,
        outputTokens: 0,
        cacheReadInputTokens: 4,
        cacheCreationInputTokens: 0,
      },
      usageSource: "provider" as const,
    },
  ];
  await storage.save(tasks);
  const file = kit.app.vault.getFileByPath("CoForge/AI-Costs/Ledger.md")!;
  await kit.app.vault.process(
    file,
    (content) =>
      content.replace(
        "type: coforge-ai-costs",
        "custom: keep\ntype: coforge-ai-costs",
      ) + "\r\nHuman accounting notes.",
  );
  await expect(storage.save(tasks)).rejects.toThrow("Refresh");
  await storage.load();
  const before = splitNote(kit.read(file.path)).body;
  await storage.save([...tasks, { ...tasks[0]!, id: "run-2", reportedUsd: 0 }]);
  expect(splitNote(kit.read(file.path)).body).toBe(before);
  expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toMatchObject({
    custom: "keep",
  });
  const reopened = await new VaultAICosts(plugin).load();
  expect(reopened).toHaveLength(2);
  expect(reopened[0]?.usage).toEqual({
    inputTokens: 12,
    outputTokens: 0,
    cacheReadInputTokens: 4,
    cacheCreationInputTokens: 0,
  });
  await kit.app.vault.delete(file);
  await expect(storage.load()).rejects.toThrow("preserved");
});
