// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin, parseYaml } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { StudioService } from "../../../features/coforge/application/studio";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { materializeWorkflowBuckets } from "../../../features/coforge/domain/workflow-buckets";
import { VaultStudioStorage } from "../../../infrastructure/coforge/vault-storage";
import { splitNote } from "../../../infrastructure/coforge/markdown";
import { nodeTimers } from "./memory-storage";

it("keeps canonical project/request body bytes and human annotations through workflow save, checkpoint and reload", async () => {
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
  const storage = new VaultStudioStorage(plugin);
  const unavailable = async () => {
    throw new Error("A manual workflow must not invoke a model.");
  };
  const studio = new StudioService(storage, {
    timers: nodeTimers(),
    runners: { demo: unavailable, claude: unavailable },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  try {
    await studio.start();
    const project = await studio.createProject({
      projectName: "Workflow vault",
      projectBrief: "A manual workflow in a contained test vault.",
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
        ) + "\r\n## Human notes\r\nKeep all body bytes.",
    );
    const projectBody = splitNote(kit.read(file.path)).body;
    const definition = materializeWorkflowBuckets(workflowDefinition(project.settings));
    definition.buckets![0]!.description = 'Keep [[bucket]] and {{description}}.\r\nExact bytes.';
    definition.steps = [
      {
        id: "review",
        name: "Manual review",
        kind: "approval",
        instructions: "Review [[this]] and {{that}}.\n\nKeep the prompt.",
        bucketId: 'inbox',
      },
    ];
    const saved = await studio.saveWorkflow(
      project.id,
      definition,
      JSON.stringify(workflowDefinition(project.settings)),
    );
    expect(splitNote(kit.read(file.path)).body).toBe(projectBody);
    expect(parseYaml(splitNote(kit.read(file.path)).yaml!)).toMatchObject({
      id: project.id,
      custom: "keep",
    });
    const reloaded = await new VaultStudioStorage(plugin).load();
    expect(
      reloaded.projects?.find((item) => item.id === project.id)?.settings
        .workflow,
    ).toEqual(saved.settings.workflow);
    const created = await studio.createIdea({
      title: "A manual request",
      description: "Keep this request description.",
      category: "Gameplay",
      username: "streamer",
    });
    expect(created.result).toBeDefined();
    const idea = studio
      .state()
      .ideas.find((idea) => idea.title === "A manual request")!;
    const note = storage.file(idea.id)!;
    await kit.app.vault.process(
      kit.app.vault.getFileByPath(note.path)!,
      (content) =>
        content.replace(
          "type: coforge-idea",
          "annotation: keep\ntype: coforge-idea",
        ) + "\r\n## Personal annotations\r\nKeep this too.",
    );
    const requestBody = splitNote(kit.read(note.path)).body;
    const run = await studio.startWorkflow(idea.id);
    expect(run.state).toBe("waiting-human");
    expect(splitNote(kit.read(note.path)).body).toBe(requestBody);
    expect(parseYaml(splitNote(kit.read(note.path)).yaml!)).toMatchObject({
      annotation: "keep",
      id: idea.id,
    });
    const loaded = await new VaultStudioStorage(plugin).load();
    expect(
      loaded.notes.find((item) => item.id === idea.id)?.workflowRun,
    ).toEqual(run);
    expect(loaded.invalidNotes).toEqual([]);
  } finally {
    await studio.stop();
  }
});
