// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultProjects } from "../../../infrastructure/coforge/vault-projects";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import { splitNote } from "../../../infrastructure/coforge/markdown";
import type { StudioProject } from "../../../features/coforge/domain/types";
async function fixture() {
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
  const storage = new VaultProjects(plugin);
  const now = new Date().toISOString();
  const project: StudioProject = {
    id: "CFP-001",
    settings: defaultSettings(),
    projectPath: "/project",
    worktreeFolder: "",
    repositoryUrl: "",
    websiteUrl: "",
    allowImplementation: false,
    createdAt: now,
    updatedAt: now,
  };
  await storage.save([project]);
  const file = kit.app.vault.getMarkdownFiles()[0]!;
  return { storage, project, kit, file };
}
it("rejects unwatched owned-field edits and lets a reviewed refresh keep those choices", async () => {
  const { storage, project, kit, file } = await fixture();
  await kit.app.vault.process(
    file,
    (content) =>
      content.replace(
        "type: coforge-project",
        "agent-provider-screen: claude\nagent-model-screen: haiku\ncustom: keep\ntype: coforge-project",
      ) + "\r\nHuman project notes stay intact.",
  );
  const external = kit.read(file.path);
  const body = splitNote(external).body;
  await expect(
    storage.save([
      {
        ...project,
        settings: { ...project.settings, projectName: "Old draft" },
      },
    ]),
  ).rejects.toThrow("changed on disk");
  expect(kit.read(file.path)).toBe(external);
  const refreshed = (await storage.load()).projects[0]!;
  await storage.save([
    {
      ...refreshed,
      settings: { ...refreshed.settings, projectName: "Reviewed update" },
    },
  ]);
  expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toMatchObject({
    custom: "keep",
    "agent-provider-screen": "claude",
    "agent-model-screen": "haiku",
    name: "Reviewed update",
  });
  expect(splitNote(kit.read(file.path)).body).toBe(body);
});
it("preserves independent Markdown/unknown-property edits when owned configuration is unchanged", async () => {
  const { storage, project, kit, file } = await fixture();
  await kit.app.vault.process(
    file,
    (content) =>
      content.replace(
        "type: coforge-project",
        "custom: keep\ntype: coforge-project",
      ) + "\r\n## Human script\r\nExact bytes.",
  );
  const body = splitNote(kit.read(file.path)).body;
  await storage.save([
    {
      ...project,
      settings: {
        ...project.settings,
        stageAgents: { screen: { provider: "claude", model: "haiku" } },
      },
    },
  ]);
  expect(splitNote(kit.read(file.path)).body).toBe(body);
  expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toHaveProperty(
    "custom",
    "keep",
  );
});
it("checks ownership atomically when an external edit lands after saving begins", async () => {
  const { storage, project, kit, file } = await fixture();
  const original = kit.app.fileManager.processFrontMatter.bind(
    kit.app.fileManager,
  );
  const external =
    kit.read(file.path).replace("model: sonnet", "model: external-model") +
    "\r\nConcurrent human notes.";
  const intercepted = vi
    .spyOn(kit.app.fileManager, "processFrontMatter")
    .mockImplementationOnce(async (target, change) => {
      await kit.app.vault.process(target, () => external);
      await original(target, change);
    });
  try {
    await expect(
      storage.save([
        { ...project, settings: { ...project.settings, model: "stale-model" } },
      ]),
    ).rejects.toThrow("changed on disk");
    expect(kit.read(file.path)).toBe(external);
  } finally {
    intercepted.mockRestore();
  }
});
it("does not overwrite an unwatched changed identity or recreate a removed canonical note", async () => {
  const first = await fixture();
  await first.kit.app.vault.process(first.file, (content) =>
    content.replace("id: CFP-001", "id: CFP-002"),
  );
  const external = first.kit.read(first.file.path);
  await expect(
    first.storage.save([
      {
        ...first.project,
        settings: { ...first.project.settings, model: "opus" },
      },
    ]),
  ).rejects.toThrow("changed on disk");
  expect(first.kit.read(first.file.path)).toBe(external);
  const second = await fixture();
  await second.kit.app.vault.delete(second.file);
  await expect(
    second.storage.save([
      {
        ...second.project,
        settings: { ...second.project.settings, model: "opus" },
      },
    ]),
  ).rejects.toThrow("changed on disk");
  expect(second.kit.app.vault.getMarkdownFiles()).toEqual([]);
});
it("keeps invalid external configuration intact and reports a recoverable note conflict", async () => {
  const { storage, project, kit, file } = await fixture();
  await kit.app.vault.process(file, (content) =>
    content.replace("model: sonnet", "model: --invalid-model"),
  );
  const external = kit.read(file.path);
  await expect(
    storage.save([
      { ...project, settings: { ...project.settings, model: "haiku" } },
    ]),
  ).rejects.toThrow("changed on disk");
  expect(kit.read(file.path)).toBe(external);
});
