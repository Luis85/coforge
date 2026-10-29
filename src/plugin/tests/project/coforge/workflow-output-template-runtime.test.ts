// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { createCoforgeRuntime } from "../../../infrastructure/coforge/runtime";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";

it("exposes the canonical project template library to the runtime UI and captures it when admitting work", async () => {
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
  try {
    await runtime.studio.store.init();
    const project = await runtime.studio.createProject({
      projectName: "Template runtime",
      projectBrief: "A private workflow template test.",
      projectPath: "/synthetic/template-runtime",
    });
    const templates = runtime.host.outputTemplates;
    if (!templates) throw new Error("Runtime output template service missing");
    const saved = await templates.save(project.id, {
      name: "Answer outline",
      markdown: "# Answer\n\n## Evidence\n",
    });
    const path = `CoForge/Output Templates/${project.id}/${saved.id}.md`;
    expect(kit.read(path)).toContain("# Answer\n\n## Evidence\n");
    expect((await templates.list(project.id)).templates).toEqual([saved]);
    expect(
      runtime.studio
        .state()
        .population?.operations.find(
          (operation) => operation.code === "workflow-output-template-saved",
        ),
    ).toMatchObject({
      entityId: project.id,
      effect: "committed",
      count: 1,
    });
    const source = workflowDefinition(project.settings);
    const step = source.steps.find((item) => item.kind === "ai");
    if (!step || step.kind !== "ai") throw new Error("AI step missing");
    await runtime.studio.saveWorkflow(
      project.id,
      {
        ...source,
        steps: [{ ...step, outputTemplateId: saved.id, automatic: false }],
      },
      JSON.stringify(source),
    );
    await runtime.studio.createIdea({
      title: "Use the answer outline",
      description: "Provide a clear answer with evidence.",
      category: "Gameplay",
      username: "streamer",
    });
    const idea = runtime.studio.state().ideas[0];
    if (!idea) throw new Error("Test request missing");
    await expect(runtime.studio.startWorkflow(idea.id)).resolves.toMatchObject({
      projectId: project.id,
      outputTemplates: [saved],
    });
    expect(kit.read("CoForge/Output Templates/.gitignore")).toContain("*");
    expect(kit.errors).toEqual([]);
  } finally {
    await runtime.dispose();
  }
});
