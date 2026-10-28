// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, addIcon, getIconIds } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { registerStreamIcons } from "../../../infrastructure/coforge/stream-icons";
import manifest from "../../../../../manifest.json";

it("registers four distinct owned public icons and removes only those icons on unload", async () => {
  const app = new App();
  const kit = createTestApp({ app });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, manifest);
  await kit.loadPlugin(plugin);
  addIcon("unrelated-icon", "<svg/>");
  registerStreamIcons(plugin);
  expect(getIconIds()).toEqual([
    "unrelated-icon",
    "coforge-stream-kanban",
    "coforge-stream-chat",
    "coforge-stream-leaderboards",
    "coforge-stream-community",
  ]);
  await kit.unloadPlugin(plugin);
  expect(getIconIds()).toEqual(["unrelated-icon"]);
});
