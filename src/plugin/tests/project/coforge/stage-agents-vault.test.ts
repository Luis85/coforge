// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { StudioService } from "../../../features/coforge/application/studio";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { splitNote } from "../../../infrastructure/coforge/markdown";
import { nodeTimers } from "./memory-storage";
it("persists and resets step agents without replacing human project Markdown or unknown properties", async () => {
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
  const storage = new VaultStudioStorage(plugin);
  const unavailable = async () => {
    throw new Error("Configuration must not dispatch a model.");
  };
  const studio = new StudioService(storage, {
    timers: nodeTimers(),
    runners: { demo: unavailable, claude: unavailable },
    probeRuntime: async () => ({
      cliAvailable: true,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  try {
    await studio.start();
    const project = await studio.createProject({
      projectName: "Agent project",
      projectBrief: "A project with independent agent steps.",
      projectPath: "/synthetic/project",
    });
    const file = kit.app.vault
      .getMarkdownFiles()
      .find((file) => file.path.startsWith("CoForge/Projects/"))!;
    await kit.app.vault.process(
      file,
      (content) =>
        content.replace(
          "type: coforge-project",
          "custom: keep\ntype: coforge-project",
        ) + "\r\n## Human project notes\r\nKeep exact body bytes.",
    );
    const body = splitNote(kit.read(file.path)).body;
    const stageAgents = {
      screen: { provider: "claude" as const, model: "haiku" },
      implement: { provider: "demo" as const },
    };
    await studio.updateProject({ stageAgents }, project.id);
    expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toMatchObject({
      id: project.id,
      custom: "keep",
      "agent-provider-screen": "claude",
      "agent-model-screen": "haiku",
      "agent-provider-implement": "demo",
    });
    expect(splitNote(kit.read(file.path)).body).toBe(body);
    const loaded = await new VaultStudioStorage(plugin).load();
    expect(
      loaded.projects?.find((item) => item.id === project.id)?.settings
        .stageAgents,
    ).toEqual(stageAgents);
    await studio.updateProject({ stageAgents: {} }, project.id);
    const reset = parseYaml(splitNote(kit.read(file.path)).yaml!);
    expect(reset).not.toHaveProperty("agent-provider-screen");
    expect(reset).not.toHaveProperty("agent-model-screen");
    expect(reset).toHaveProperty("custom", "keep");
    expect(splitNote(kit.read(file.path)).body).toBe(body);
  } finally {
    await studio.stop();
  }
});
