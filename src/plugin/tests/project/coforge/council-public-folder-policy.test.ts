import { councilControlsFixture } from "./council-controls-fixture";
import { SCHEDULED_TASK_FOLDER } from "../../../features/coforge/domain/scheduled-task";
import { COUNCIL_TASK_FOLDER } from "../../../features/coforge/domain/council-task";
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

it.each([SCHEDULED_TASK_FOLDER, `${SCHEDULED_TASK_FOLDER}/Nested`, COUNCIL_TASK_FOLDER])(
  "rejects a watched inbox over managed task output %s before admission or note writes",
  async path => {
    const f = await councilControlsFixture();
    try {
      const revision = f.module.actions.snapshot().preferences.revision;
      await expect(f.module.actions.saveBindings([{
        id: "output-loop", path, projectId: f.projectId, teamId: "team", target: { kind: "agent", id: "agent" },
        enabled: true, recursive: true, submit: "after-stable", settleMs: 0,
      }], revision)).rejects.toThrow(/output folder|overlaps/i);
      expect(f.module.actions.snapshot().preferences.bindings).toHaveLength(0);
      expect(f.module.actions.snapshot().runs).toHaveLength(0);
      expect(f.app.vault.getAbstractFileByPath(path)).toBeNull();
    } finally { await f.dispose(); }
  },
);
