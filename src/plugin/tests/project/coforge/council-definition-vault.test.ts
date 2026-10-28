// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { CouncilCatalogue } from "../../../features/coforge/application/council-catalogue";
import { agentDefinitionCheck } from "../../../features/coforge/domain/council-definitions";
import {
  DEFAULT_COUNCIL_FOLDERS,
  VaultCouncilDefinitions,
} from "../../../infrastructure/coforge/vault-council-definitions";

it("protects private folders before writes and follows a canonical definition through rename and external edits", async () => {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const protection: string[][] = [];
  const catalogue = new CouncilCatalogue(
    new VaultCouncilDefinitions(
      plugin,
      DEFAULT_COUNCIL_FOLDERS,
      async (paths) => {
        expect(app.vault.getMarkdownFiles()).toHaveLength(0);
        protection.push(paths);
      },
    ),
  );
  const agent = agentDefinitionCheck({
    schema: "agent/v1",
    id: "reviewer",
    name: "Reviewer",
    enabled: true,
    role: "Review",
    instructions: "Inspect boundaries.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  });
  await catalogue.save(agent);
  expect(protection[0]).toEqual(Object.values(DEFAULT_COUNCIL_FOLDERS));
  const file = app.vault.getFileByPath("CoForge/Agents/reviewer.md");
  if (!file) throw new Error("Expected created definition.");
  await app.vault.process(
    file,
    (current) =>
      current.replace(
        "coforge:",
        'custom: "keep exactly" # private annotation\ncoforge:',
      ) + "\r\n## Human notes\r\nPreserve every byte.",
  );
  await app.vault.rename(file, "CoForge/Agents/Moved.md");
  const writable = new CouncilCatalogue(
    new VaultCouncilDefinitions(
      plugin,
      DEFAULT_COUNCIL_FOLDERS,
      async () => undefined,
    ),
  );
  const entry = (await writable.list()).valid[0]!;
  expect(entry.path).toBe("CoForge/Agents/Moved.md");
  await writable.save(
    { ...agent, instructions: "Revised boundaries." },
    entry.revision,
  );
  const saved = kit.read("CoForge/Agents/Moved.md");
  expect(saved).toContain('custom: "keep exactly" # private annotation\n');
  expect(saved).toContain("\r\n## Human notes\r\nPreserve every byte.");
  expect((await writable.list()).valid[0]!.definition).toMatchObject({
    id: "reviewer",
    instructions: "Revised boundaries.",
  });
  expect(app.vault.getFileByPath("CoForge/Agents/reviewer.md")).toBeNull();
  await app.vault.process(file, (current) =>
    current.replace("schema: agent/v1", "schema: unsupported/v9"),
  );
  expect((await writable.list()).valid).toHaveLength(0);
  expect((await writable.list()).invalid).toHaveLength(1);
  await expect(writable.save(agent, entry.revision)).rejects.toThrow(
    /invalid|unavailable/i,
  );
  expect(kit.errors).toEqual([]);
});
it("previews configurable folders without writes and follows metadata-indexed definitions after moves outside the original folder", async () => {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  let folders = { ...DEFAULT_COUNCIL_FOLDERS };
  const protections: string[][] = [];
  const storage = new VaultCouncilDefinitions(
    plugin,
    () => folders,
    async (paths) => {
      protections.push(paths);
    },
  );
  const catalogue = new CouncilCatalogue(storage);
  const agent = agentDefinitionCheck({
    schema: "agent/v1",
    id: "moving",
    name: "Moving reviewer",
    enabled: true,
    role: "Review",
    instructions: "Review this.",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  });
  await catalogue.save(agent);
  await kit.flush();
  await app.vault.createFolder("Private agents");
  const file = app.vault.getFileByPath("CoForge/Agents/moving.md");
  if (!file) throw new Error("Expected initial agent note.");
  await app.vault.rename(file, "Private agents/Moved.md");
  await kit.flush();
  const moved = (await catalogue.list()).valid.find(
    (entry) => entry.definition.id === agent.id,
  )!;
  expect(moved.path).toBe("Private agents/Moved.md");
  await catalogue.save({ ...agent, name: "Edited after move" }, moved.revision);
  expect(protections.flat()).toContain("Private agents");
  const before = kit.read("Private agents/Moved.md");
  const preview = await storage.previewFolders({
    agents: "New agents",
    teams: "New teams",
    councils: "New councils",
  });
  expect(preview.definitionCount).toBe(1);
  expect(kit.read("Private agents/Moved.md")).toBe(before);
  expect(app.vault.getAbstractFileByPath("New agents")).toBeNull();
  await expect(
    storage.previewFolders({ ...folders, agents: "CoForge/Public/Agents" }),
  ).rejects.toThrow(/private/i);
  folders = preview.folders;
  await catalogue.save({ ...agent, id: "new-reviewer", name: "New reviewer" });
  expect(app.vault.getFileByPath("New agents/new-reviewer.md")).not.toBeNull();
  expect(app.vault.getFileByPath("Private agents/Moved.md")).not.toBeNull();
  expect(kit.errors).toEqual([]);
});
