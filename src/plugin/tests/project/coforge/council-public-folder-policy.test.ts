// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { StudioService } from "../../../features/coforge/application/studio";
import { createSeed } from "../../../features/coforge/domain/seed";
import { PublicSitePublisher } from "../../../infrastructure/coforge/public-site-publisher";
import { MemoryStorage, nodeTimers } from "./memory-storage";

it.each(["Private/Agents", "Private/Inbox", "Private/Manual notes"])(
  "rejects moving public exports over registered Council privacy scope %s",
  async (folder) => {
    const studio = new StudioService(new MemoryStorage(createSeed()), {
      timers: nodeTimers(),
      runners: { demo: async () => ({}), claude: async () => ({}) },
      privateFolders: () => [folder],
      probeRuntime: async () => ({
        cliAvailable: false,
        projectPath: null,
        allowImplementation: false,
      }),
    });
    await studio.store.init();
    const original = studio.integration().publicFolder;
    await expect(
      studio.updateIntegration({ publicFolder: folder }),
    ).rejects.toThrow(/private|public/i);
    expect(studio.integration().publicFolder).toBe(original);
    await studio.stop();
  },
);

it("rechecks registered private folders at publication even when the configured public path changed externally", async () => {
  const app = new App();
  const kit = createTestApp({
    app,
    files: { "Private/Agents/Reviewer.md": "# Private instructions" },
  });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const publisher = new PublicSitePublisher(
    plugin,
    () => ({ ideasFolder: "CoForge/Ideas", publicFolder: "Private/Agents" }),
    () => ["Private/Agents"],
  );
  await expect(
    publisher.publish(createSeed(), "Private/Agents"),
  ).rejects.toThrow(/private|public/i);
  expect(
    app.vault.getAbstractFileByPath("Private/Agents/board.json"),
  ).toBeNull();
  expect(kit.read("Private/Agents/Reviewer.md")).toBe("# Private instructions");
});
