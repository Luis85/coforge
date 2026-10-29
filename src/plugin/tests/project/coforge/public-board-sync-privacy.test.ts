// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { StudioService } from "../../../features/coforge/application/studio";
import { createSeed } from "../../../features/coforge/domain/seed";
import { PublicSitePublisher } from "../../../infrastructure/coforge/public-site-publisher";
import { syncPublicBoard } from "../../../infrastructure/coforge/public-board-sync";
import { MemoryStorage, nodeTimers } from "./memory-storage";

afterEach(() => {
  vi.useRealTimers();
});
async function fixture() {
  const app = new App();
  createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const studio = new StudioService(new MemoryStorage(createSeed()), {
    timers: nodeTimers(),
    runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.store.init();
  const publisher = new PublicSitePublisher(
    plugin,
    () => studio.integration(),
    () => [],
    () => studio.state(),
  );
  await publisher.publish(studio.state(), "CoForge/Public");
  return { app, studio, publisher };
}

it("revokes observed privacy denials immediately even when automatic exports are disabled", async () => {
  const f = await fixture();
  const errors = vi.fn();
  await f.studio.updateIntegration({ publicBoardEnabled: false });
  const stale = f.studio.state();
  const stop = syncPublicBoard(f.studio, f.publisher, errors);
  try {
    // An external private-note observation can fail cancellation before any project transaction starts.
    f.studio.store.denyPublicProjects([f.studio.state().activeProjectId!]);
    await vi.waitFor(async () =>
      expect(
        await f.app.vault.adapter.exists("CoForge/Public/board.json"),
      ).toBe(false),
    );
    expect(errors).not.toHaveBeenCalled();
    expect(f.studio.state().projects![0]!.visibility).not.toBe("private");
    await f.publisher.publish(stale, "CoForge/Public");
    expect(
      await f.app.vault.adapter.read("CoForge/Public/board.json"),
    ).not.toContain("Mosslight");
  } finally {
    stop();
    await f.studio.stop();
  }
});

it("does not execute an automatic export queued before its synchronizer was stopped", async () => {
  const f = await fixture();
  await f.studio.updateIntegration({ publicBoardEnabled: true });
  vi.useFakeTimers();
  const errors = vi.fn();
  const publish = vi.spyOn(f.publisher, "publishCurrent");
  const next = f.studio.state();
  next.projects![0]!.visibility = "private";
  const release = await f.publisher.beforeCommit(next, f.studio.state());
  const stop = syncPublicBoard(f.studio, f.publisher, errors);
  try {
    await vi.advanceTimersByTimeAsync(3000);
    expect(publish).toHaveBeenCalledTimes(1);
    stop();
    release?.();
    // This disabled request forms a queue barrier without generating another export.
    await f.publisher.publishCurrent(
      () => f.studio.state(),
      () => "CoForge/Public",
      () => false,
    );
    expect(await f.app.vault.adapter.exists("CoForge/Public/board.json")).toBe(
      false,
    );
    expect(errors).not.toHaveBeenCalled();
  } finally {
    stop();
    release?.();
    await f.studio.stop();
  }
});
