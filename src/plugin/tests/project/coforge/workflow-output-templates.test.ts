// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp } from "@test/obsidian";
import { VaultWorkflowOutputTemplates } from "../../../infrastructure/coforge/vault-workflow-output-templates";
import { readWorkflowOutputTemplateNote } from "../../../infrastructure/coforge/workflow-output-template-notes";
import { WorkflowEngine } from "../../../features/coforge/application/engine";
import { executionSystemPrompt } from "../../../features/coforge/application/workflow-execution";
import { workflowRunCheck } from "../../../features/coforge/domain/configured-workflow-run";
import { validateFolderLayout } from "../../../features/coforge/domain/vault-folder-policy";
import { ai, definition } from "./configured-workflow-fixture";
import { nodeTimers, seededStore } from "./memory-storage";
import type { StageInput } from "../../../features/coforge/application/ports";
import { councilFolderPolicy } from "../../../infrastructure/coforge/council-private-data";
import { validateIntakeBindings } from "../../../features/coforge/domain/intake-bindings";
import { configuredAttempt } from "../../../features/coforge/application/configured-workflow-policy";

function fixture() {
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
  const protect = vi.fn(async (_paths: string[]) => undefined);
  const templates = new VaultWorkflowOutputTemplates(plugin, protect, (id) => {
    if (!["CFP-001", "CFP-002"].includes(id))
      throw new Error("Unavailable project");
  });
  return { app, kit, plugin, templates, protect };
}

it("creates canonical project Markdown, reloads, edits while preserving unrelated frontmatter and deletes to vault trash", async () => {
  const { app, kit, templates, protect } = fixture();
  const created = await templates.save("CFP-001", {
    name: "Decision record",
    markdown: "# Decision\n\n## Reasons\n",
  });
  const path = `CoForge/Output Templates/CFP-001/${created.id}.md`;
  expect(kit.read(path)).toContain("# Decision\n\n## Reasons\n");
  expect(protect).toHaveBeenCalledWith(["CoForge/Output Templates"]);
  expect((await templates.list("CFP-002")).templates).toEqual([]);
  const file = app.vault.getFileByPath(path)!;
  await app.vault.process(file, (current) =>
    current.replace("coforge:", 'custom: "keep exact" # owner\ncoforge:'),
  );
  const latest = (await templates.list("CFP-001")).templates[0]!;
  const saved = await templates.save(
    "CFP-001",
    {
      ...latest,
      name: "Review record",
      markdown: "# Verdict\n\n## Evidence\n",
    },
    latest.revision,
  );
  expect(saved.id).toBe(created.id);
  expect(kit.read(path)).toContain('custom: "keep exact" # owner\n');
  expect(readWorkflowOutputTemplateNote(kit.read(path))).toEqual(saved);
  await templates.remove("CFP-001", saved.id, saved.revision);
  expect(app.vault.getFileByPath(path)).toBeNull();
  expect((await templates.list("CFP-001")).templates).toEqual([]);
  expect(kit.errors).toEqual([]);
});

it("rejects stale edits/deletion, cross-project access, occupied identity and invalid duplicates without altering notes", async () => {
  const { app, kit, templates } = fixture();
  const created = await templates.save("CFP-001", {
    name: "Answer",
    markdown: "# Original",
  });
  const path = `CoForge/Output Templates/CFP-001/${created.id}.md`;
  const file = app.vault.getFileByPath(path)!;
  await app.vault.process(file, (current) => current + "\nHuman change");
  const external = kit.read(path);
  await expect(
    templates.save(
      "CFP-001",
      { ...created, markdown: "Overwrite" },
      created.revision,
    ),
  ).rejects.toThrow(/changed/i);
  await expect(
    templates.remove("CFP-001", created.id, created.revision),
  ).rejects.toThrow(/changed/i);
  await expect(
    templates.save(
      "CFP-002",
      { ...created, markdown: "Other project" },
      created.revision,
    ),
  ).rejects.toThrow();
  await expect(templates.open("CFP-002", created.id)).rejects.toThrow();
  expect(kit.read(path)).toBe(external);
  await app.vault.create(
    `CoForge/Output Templates/CFP-001/duplicate.md`,
    external,
  );
  const listed = await templates.list("CFP-001");
  expect(listed.templates).toEqual([]);
  expect(listed.invalid).toHaveLength(2);
  await expect(
    templates.save("CFP-001", created, created.revision),
  ).rejects.toThrow();
  expect(kit.read(path)).toBe(external);
});

it("preserves an external rename within the private project folder and refuses templates moved into another project", async () => {
  const { app, templates } = fixture();
  const created = await templates.save("CFP-001", {
    name: "Answer",
    markdown: "# Answer",
  });
  const file = app.vault.getFileByPath(
    `CoForge/Output Templates/CFP-001/${created.id}.md`,
  )!;
  await app.vault.rename(
    file,
    "CoForge/Output Templates/CFP-001/My template.md",
  );
  expect((await templates.list("CFP-001")).templates[0]?.id).toBe(created.id);
  await templates.save(
    "CFP-001",
    { ...created, name: "Renamed" },
    created.revision,
  );
  await app.vault.createFolder("CoForge/Output Templates/CFP-002");
  await app.vault.rename(
    file,
    "CoForge/Output Templates/CFP-002/My template.md",
  );
  expect((await templates.list("CFP-002")).templates).toEqual([]);
  expect((await templates.list("CFP-002")).invalid).toHaveLength(1);
});

it("preserves a note edited between the delete content check and its final trash guard", async () => {
  const { app, kit, templates } = fixture();
  const saved = await templates.save("CFP-001", {
    name: "Answer",
    markdown: "# Answer",
  });
  const path = `CoForge/Output Templates/CFP-001/${saved.id}.md`;
  const process = app.vault.process.bind(app.vault);
  vi.spyOn(app.vault, "process").mockImplementationOnce(async (file, fn) => {
    const result = await process(file, fn);
    await app.vault.modify(file, result + "\nExternal edit during deletion");
    return result;
  });
  await expect(
    templates.remove("CFP-001", saved.id, saved.revision),
  ).rejects.toThrow(/changed/i);
  expect(kit.read(path)).toContain("External edit during deletion");
});

it("preserves a note moved outside its project between validation and trash", async () => {
  const { app, templates } = fixture();
  const saved = await templates.save("CFP-001", {
    name: "Answer",
    markdown: "# Answer",
  });
  await app.vault.createFolder("Private");
  const process = app.vault.process.bind(app.vault);
  vi.spyOn(app.vault, "process").mockImplementationOnce(async (file, fn) => {
    const result = await process(file, fn);
    await app.vault.rename(file, "Private/Preserved template.md");
    return result;
  });
  await expect(
    templates.remove("CFP-001", saved.id, saved.revision),
  ).rejects.toThrow(/moved/i);
  expect(
    app.vault.getFileByPath("Private/Preserved template.md"),
  ).not.toBeNull();
});

it("reserves template notes against public exports and rejects malformed metadata without writing", async () => {
  expect(() =>
    validateFolderLayout({
      ideasFolder: "CoForge/Ideas",
      publicFolder: "CoForge/Output Templates/Public",
    }),
  ).toThrow();
  const { app, templates } = fixture();
  await expect(
    templates.save("CFP-001", { name: "Empty", markdown: "" }),
  ).rejects.toThrow();
  await expect(
    templates.save("../outside", { name: "Answer", markdown: "# Answer" }),
  ).rejects.toThrow();
  expect(app.vault.getMarkdownFiles()).toEqual([]);
});

it("prevents watched inboxes from treating template edits as new agent work", () => {
  const { plugin } = fixture();
  const binding = {
    id: "templates",
    path: "CoForge/Output Templates",
    projectId: "CFP-001",
    teamId: "team",
    target: { kind: "agent" as const, id: "agent" },
    enabled: true,
    recursive: true,
    submit: "after-stable" as const,
    settleMs: 0,
  };
  expect(() =>
    validateIntakeBindings(
      [binding],
      councilFolderPolicy(plugin, "CoForge/Public", []),
    ),
  ).toThrow(/folder/i);
});

it("pins template content for every step when a run starts and keeps it after deletion or definition edits", async () => {
  const { templates } = fixture();
  const { store } = await seededStore();
  const projectId = store.snapshot().activeProjectId!;
  // The seeded project uses CFP-001.
  const saved = await templates.save(projectId, {
    name: "Decision",
    markdown: "# Original answer\n\n## Evidence",
  });
  await store.transaction((state) => {
    state.settings.workflow = definition([
      { ...ai("first"), outputTemplateId: saved.id },
      {
        kind: "approval",
        id: "review",
        name: "Review",
        instructions: "Inspect",
      },
      { ...ai("last"), outputTemplateId: saved.id },
    ]);
    state.settings.paused = false;
  });
  const idea = store.snapshot().ideas.find((item) => item.status === "inbox")!;
  const calls: StageInput[] = [];
  const runner = async (input: StageInput) => {
    calls.push(input);
    return { markdown: "# Result" };
  };
  const engine = new WorkflowEngine(store, {
    outputTemplates: templates,
    runners: { demo: runner, claude: runner },
    timers: nodeTimers(),
  });
  try {
    await engine.startWorkflow(idea.id);
    await engine.waitUntilIdle();
    const run = store
      .snapshot()
      .ideas.find((item) => item.id === idea.id)!.workflowRun!;
    expect(workflowRunCheck(run).outputTemplates).toEqual([saved]);
    expect(executionSystemPrompt(calls[0]!)).toContain(saved.markdown);
    expect(executionSystemPrompt(calls[0]!)).toContain(
      "required structured output",
    );
    await templates.remove(projectId, saved.id, saved.revision);
    await engine.completeWorkflowManual(idea.id, run.revision, []);
    await engine.waitUntilIdle();
    expect(calls).toHaveLength(2);
    expect(executionSystemPrompt(calls[1]!)).toContain(saved.markdown);
  } finally {
    await engine.stop();
  }
});

it("blocks missing templates before a run or provider request exists", async () => {
  const { templates } = fixture();
  const { store } = await seededStore();
  await store.transaction((state) => {
    state.settings.workflow = definition([
      { ...ai("answer"), outputTemplateId: "missing" },
    ]);
  });
  const idea = store.snapshot().ideas.find((item) => item.status === "inbox")!;
  const runner = vi.fn(async () => ({ markdown: "# Result" }));
  const engine = new WorkflowEngine(store, {
    outputTemplates: templates,
    runners: { demo: runner, claude: runner },
    timers: nodeTimers(),
  });
  try {
    await expect(engine.startWorkflow(idea.id)).rejects.toThrow(/template/i);
    expect(
      store.snapshot().ideas.find((item) => item.id === idea.id)?.workflowRun,
    ).toBeUndefined();
    expect(runner).not.toHaveBeenCalled();
  } finally {
    await engine.stop();
  }
});

it("rejects a provider snapshot whose template changed from the captured run", async () => {
  const { templates } = fixture();
  const { store } = await seededStore();
  const saved = await templates.save(store.snapshot().activeProjectId!, {
    name: "Answer",
    markdown: "# Answer",
  });
  await store.transaction((state) => {
    state.settings.workflow = definition([
      { ...ai("answer"), outputTemplateId: saved.id },
    ]);
  });
  const idea = store.snapshot().ideas.find((item) => item.status === "inbox")!;
  const runner = vi.fn(async () => ({ markdown: "# Result" }));
  const engine = new WorkflowEngine(store, {
    outputTemplates: templates,
    runners: { demo: runner, claude: runner },
    timers: nodeTimers(),
  });
  await engine.stop();
  await engine.startWorkflow(idea.id);
  const state = store.internalSnapshot();
  const job = state.jobs.find(
    (item) => item.ideaId === idea.id && item.status === "queued",
  )!;
  expect(configuredAttempt(state, job).snapshot.outputTemplate).toEqual(saved);
  job.workflow!.outputTemplate!.markdown = "# Replaced";
  expect(() => configuredAttempt(state, job)).toThrow(/template changed/i);
  expect(runner).not.toHaveBeenCalled();
});
