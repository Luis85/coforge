// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { createCoforgeRuntime } from "../../../infrastructure/coforge/runtime";
import { CouncilModule } from "../../../infrastructure/coforge/council-module";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { StudioService } from "../../../features/coforge/application/studio";
import type { Timers } from "../../../features/coforge/application/ports";
import { MemoryStorage, nodeTimers } from "./memory-storage";

it.each([
  "coforge-service-design.json",
  "coforge-workspaces.json",
  "coforge-council-settings.json",
  "coforge-execution-v2.json",
  "coforge-herdr.json",
  "coforge-herdr-workflow.json",
])(
  "does not revive listeners or timers when %s returns after unload",
  async (filename) => {
    const app = new App();
    const kit = createTestApp({ app, layoutReady: true });
    const plugin = new (class extends Plugin {})(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      description: "",
      author: "",
    });
    const runtime = createCoforgeRuntime(plugin, () => undefined);
    const originalExists = app.vault.adapter.exists.bind(app.vault.adapter);
    let release = () => {};
    let waiting = false;
    const held = new Promise<boolean>((resolve) => {
      release = () => resolve(false);
    });
    const exists = vi
      .spyOn(app.vault.adapter, "exists")
      .mockImplementation((path) => {
        if (path.endsWith(`/${filename}`)) {
          waiting = true;
          return held;
        }
        return originalExists(path);
      });
    const observe = vi.spyOn(app.vault, "on");
    const interval = vi.spyOn(window, "setInterval");
    const startup = runtime.start();
    try {
      await vi.waitFor(() => expect(waiting).toBe(true));
      await runtime.dispose();
      const listenersAfterUnload = observe.mock.calls.length;
      const timersAfterUnload = interval.mock.calls.length;
      release();
      await startup;
      expect(observe.mock.calls.length).toBe(listenersAfterUnload);
      expect(interval.mock.calls.length).toBe(timersAfterUnload);
      expect(
        kit.app.statusBarEl.querySelector(".coforge-native-statusbar"),
      ).toBeNull();
    } finally {
      release();
      await startup;
      await runtime.dispose();
      exists.mockRestore();
      observe.mockRestore();
      interval.mockRestore();
    }
  },
);

it("clears Council observation when unload occurs before startup receives its cleanup", async () => {
  const app = new App();
  createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, {
    id: "coforge", name: "CoForge", version: "0.1.0",
    minAppVersion: "1.13.7", description: "", author: "",
  });
  const originalTimers = nodeTimers();
  const clear = vi.fn(originalTimers.clearInterval);
  let councilInterval: number | undefined;
  let unloading: Promise<void> | undefined;
  const timers: Timers = {
    ...originalTimers,
    clearInterval: clear,
    setInterval: (callback, delay) => {
      const id = originalTimers.setInterval(callback, delay);
      councilInterval = id;
      unloading = module.dispose();
      return id;
    },
  };
  const runner = async () => ({ markdown: "Unused legacy result" });
  const studio = new StudioService(new MemoryStorage(), {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false, projectPath: null, allowImplementation: false,
    }),
  });
  await studio.store.init();
  const module = new CouncilModule(plugin, studio, timers, new InvocationGate());
  try {
    await module.start();
    await unloading;
    expect(councilInterval).toBeDefined();
    expect(clear).toHaveBeenCalledWith(councilInterval);
    expect(module.actions.snapshot().ready).toBe(false);
  } finally {
    if (councilInterval !== undefined) originalTimers.clearInterval(councilInterval);
    await module.dispose();
    await studio.stop();
  }
});
