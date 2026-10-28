// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import {
  VaultCouncilDefinitions,
  DEFAULT_COUNCIL_FOLDERS,
} from "../../../infrastructure/coforge/vault-council-definitions";
import { CouncilInboxWatcher } from "../../../infrastructure/coforge/council-inbox-watcher";
import { CouncilSourceNotes } from "../../../infrastructure/coforge/council-source-notes";
import { agentDefinitionCheck } from "../../../features/coforge/domain/council-definitions";

it("shares event invalidation, enumerates once and rereads only the changed definition while retaining live validation", async () => {
  const app = new App();
  createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    author: "",
    description: "",
  });
  const storage = new VaultCouncilDefinitions(
    plugin,
    DEFAULT_COUNCIL_FOLDERS,
    async () => undefined,
  );
  const definition = agentDefinitionCheck({
    schema: "agent/v1",
    id: "agent",
    name: "Agent",
    enabled: true,
    role: "Review",
    instructions: "InspectA",
    provider: "demo",
    model: "sonnet",
    contextSources: [],
    requestedCapabilities: { project: "none", messaging: false },
  });
  await storage.save(definition);
  await app.vault.create("Unrelated.md", "Do not read unrelated material.");
  const watcher = new CouncilInboxWatcher(
    app.vault,
    new CouncilSourceNotes(app.vault, () => []),
    {
      changed: (event) =>
        storage.invalidate(event.path, event.oldPath, event.folder, event.metadataOnly),
      candidates: async () => undefined,
      error: () => undefined,
    },
    {
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (id) => window.clearTimeout(id),
    },
    Date.now,
    app.metadataCache,
  );
  await watcher.start([]);
  await storage.scan();
  const enumerate = vi.spyOn(app.vault, "getMarkdownFiles");
  const read = vi.spyOn(app.vault, "read");
  await storage.scan();
  await storage.scan();
  expect(enumerate).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
  const file = app.vault.getFileByPath("CoForge/Agents/agent.md")!;
  await app.vault.modify(
    file,
    (await app.vault.read(file)).replace("InspectA", "InspectB"),
  );
  read.mockClear();
  const changed = await storage.scan();
  expect(changed.valid[0]?.definition).toMatchObject({
    instructions: "InspectB",
  });
  expect(read.mock.calls.map(([item]) => item.path)).toEqual([file.path]);
  expect(enumerate).not.toHaveBeenCalled();
  watcher.dispose();
  read.mockRestore();
  enumerate.mockRestore();
});
