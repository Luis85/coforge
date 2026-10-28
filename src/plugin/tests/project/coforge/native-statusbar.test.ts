// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { mountNativeStatusbar } from "../../../infrastructure/coforge/native-statusbar";
import { disconnectedTwitch } from "../../../features/coforge/domain/twitch";
import { emptyStore } from "./memory-storage";

describe("native CoForge status", () => {
  it("uses compact read-only text, preserves unchanged DOM and cleans up on unload", async () => {
    const app = new App();
    const kit = createTestApp({ app });
    class TestPlugin extends Plugin {}
    const plugin = new TestPlugin(app, {
      id: "coforge",
      name: "CoForge",
      version: "0.1.0",
      minAppVersion: "1.13.7",
      description: "",
      author: "",
    });
    plugin.load();
    const { store } = await emptyStore();
    const dispose = mountNativeStatusbar(plugin, store);
    const item = kit.app.statusBarEl.querySelector(".coforge-native-statusbar");
    if (!item) throw new Error("Native status item did not mount.");
    expect(item.querySelector("button, a, [tabindex]")).toBeNull();
    expect(item.textContent).toBe("CoForge · Chat offline · idle");
    const text = item.firstChild;
    const changed = vi.fn();
    const observer = new MutationObserver(changed);
    observer.observe(item, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    try {
      await store.updateRuntime({
        chatStatus: "Unrelated chat diagnostic changed.",
      });
      await Promise.resolve();
      expect(item.firstChild).toBe(text);
      expect(changed).not.toHaveBeenCalled();
      await store.updateRuntime({
        twitch: {
          ...disconnectedTwitch(),
          phase: "connected",
          message: "Connected",
          canChat: true,
        },
      });
      expect(item.textContent).toBe("CoForge · Chat connected · idle");
      expect(changed).toHaveBeenCalled();
      plugin.unload();
      expect(
        kit.app.statusBarEl.querySelector(".coforge-native-statusbar"),
      ).toBeNull();
      const last = item.textContent;
      await store.updateRuntime({ twitch: disconnectedTwitch() });
      expect(item.textContent).toBe(last);
      dispose();
    } finally {
      observer.disconnect();
      dispose();
      document.body.replaceChildren();
    }
  });
});
