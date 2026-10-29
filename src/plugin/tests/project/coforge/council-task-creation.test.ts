// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { defaultCouncilDefinition } from "../../../features/coforge/domain/council-definitions";
import { COUNCIL_TASK_FOLDER } from "../../../features/coforge/domain/council-task";
import { CouncilModule } from "../../../infrastructure/coforge/council-module";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { readCouncilSource } from "../../../infrastructure/coforge/council-source-notes";
import { councilControlsFixture } from "./council-controls-fixture";
import { nodeTimers } from "./memory-storage";
import { reviewedCouncilIdentity } from "../../../features/coforge/application/reviewed-preflight";
import { VaultCouncilTaskNotes } from "../../../infrastructure/coforge/council-task-notes";
import { CouncilSourceNotes } from "../../../infrastructure/coforge/council-source-notes";

async function fixture() {
  const value = await councilControlsFixture(false);
  const team = (await value.module.actions.catalogue.list()).valid.find(
    (item) => item.definition.id === "team",
  )?.definition;
  if (!team || team.schema !== "team/v1") throw new Error("Missing test team");
  await value.module.actions.catalogue.save(
    defaultCouncilDefinition("advice", "Advice", team, team.members),
  );
  const input = {
    projectId: value.projectId,
    target: { kind: "council" as const, id: "advice", teamId: team.id },
    title: "Which route should we build?",
    question: "Preserve **this wording**.\r\n\r\nCompare both routes.\r\n",
    idempotencyKey: "draft-one",
  };
  return { ...value, input };
}

it("saves a private typed analytical task without executor designation or admission, and lists it after reload", async () => {
  const value = await fixture();
  let reloaded: CouncilModule | undefined;
  try {
    const before = JSON.stringify(value.studio.state().ideas);
    const task = await value.module.actions.createTask(value.input);
    const markdown = value.kit.read(task.path);
    expect(task).toMatchObject({
      projectId: value.projectId,
      title: value.input.title,
      target: value.input.target,
    });
    expect(task.path.startsWith(COUNCIL_TASK_FOLDER + "/")).toBe(true);
    expect(
      markdown.endsWith(
        "# " + value.input.title + "\n\n" + value.input.question,
      ),
    ).toBe(true);
    expect(readCouncilSource(markdown, task.path, [])).toMatchObject({
      sourceId: task.sourceId,
      draft: false,
      ready: false,
    });
    expect(value.kit.read(COUNCIL_TASK_FOLDER + "/.gitignore")).toContain(
      "CoForge Council private data",
    );
    expect(value.module.actions.snapshot().runs).toHaveLength(0);
    expect(JSON.stringify(value.studio.state().ideas)).toBe(before);
    await value.module.dispose();
    reloaded = new CouncilModule(
      value.plugin,
      value.studio,
      nodeTimers(),
      new InvocationGate(),
    );
    await reloaded.start();
    expect(await reloaded.actions.listTasks()).toEqual([task]);
    expect(reloaded.actions.snapshot().runs).toHaveLength(0);
  } finally {
    await reloaded?.dispose();
    await value.dispose();
  }
});

it("retries the same draft idempotently, rejects changed input or changed notes, and preserves every byte", async () => {
  const value = await fixture();
  try {
    const first = await value.module.actions.createTask(value.input);
    const original = value.kit.read(first.path);
    expect(await value.module.actions.createTask(value.input)).toEqual(first);
    await expect(
      value.module.actions.createTask({
        ...value.input,
        question: "A changed question",
      }),
    ).rejects.toThrow(/changed|conflict/iu);
    const file = value.app.vault
      .getMarkdownFiles()
      .find((item) => item.path === first.path);
    if (!file) throw new Error("Missing created task");
    const edited = original + "\nHuman annotation stays.\n";
    await value.app.vault.modify(file, edited);
    await expect(value.module.actions.createTask(value.input)).rejects.toThrow(
      /changed|conflict/iu,
    );
    expect(value.kit.read(first.path)).toBe(edited);
    expect(
      value.app.vault
        .getMarkdownFiles()
        .filter((item) => item.path.startsWith(COUNCIL_TASK_FOLDER + "/")),
    ).toHaveLength(1);
  } finally {
    await value.dispose();
  }
});

it("recovers an uncertain successful create without a second task or provider invocation", async () => {
  const value = await fixture();
  try {
    const create = value.app.vault.create.bind(value.app.vault);
    const failAfterWrite = vi
      .spyOn(value.app.vault, "create")
      .mockImplementationOnce(async (path, markdown) => {
        await create(path, markdown);
        throw new Error("Unknown write outcome");
      });
    await expect(value.module.actions.createTask(value.input)).rejects.toThrow(
      "Unknown write outcome",
    );
    failAfterWrite.mockRestore();
    const retried = await value.module.actions.createTask(value.input);
    expect(await value.module.actions.listTasks()).toEqual([retried]);
    expect(value.module.actions.snapshot().runs).toHaveLength(0);
  } finally {
    await value.dispose();
  }
});

it("rejects blank questions, foreign project destinations and public-folder overlap before creating a task", async () => {
  const value = await fixture();
  try {
    await expect(
      value.module.actions.createTask({ ...value.input, question: " \n " }),
    ).rejects.toThrow(/question/iu);
    await expect(
      value.module.actions.createTask({ ...value.input, projectId: "missing" }),
    ).rejects.toThrow(/project/iu);
    await expect(
      value.module.actions.createTask({
        ...value.input,
        target: { ...value.input.target, kind: "agent" },
      }),
    ).rejects.toThrow();
    await value.studio.store.transaction((state) => {
      state.integration.publicFolder = COUNCIL_TASK_FOLDER;
    });
    await expect(value.module.actions.createTask(value.input)).rejects.toThrow(
      /private|public/iu,
    );
    expect(
      value.app.vault
        .getMarkdownFiles()
        .filter((item) => item.path.startsWith(COUNCIL_TASK_FOLDER + "/")),
    ).toHaveLength(0);
  } finally {
    await value.dispose();
  }
});

it("preserves stable task identity through a private filename change and rejects duplicate copies", async () => {
  const value = await fixture();
  try {
    const task = await value.module.actions.createTask(value.input);
    const file = value.app.vault
      .getMarkdownFiles()
      .find((item) => item.path === task.path);
    if (!file) throw new Error("Missing task file");
    const renamed = `${COUNCIL_TASK_FOLDER}/My renamed question.md`;
    await value.app.vault.rename(file, renamed);
    expect(await value.module.actions.createTask(value.input)).toEqual({
      ...task,
      path: renamed,
    });
    await value.app.vault.create(
      `${COUNCIL_TASK_FOLDER}/Duplicate.md`,
      value.kit.read(renamed),
    );
    await expect(value.module.actions.listTasks()).rejects.toThrow(
      /duplicate/iu,
    );
    await expect(value.module.actions.createTask(value.input)).rejects.toThrow(
      /duplicate/iu,
    );
  } finally {
    await value.dispose();
  }
});

it("blocks a legacy overlapping watched inbox before any task write or privacy side effect", async () => {
  const value = await fixture();
  try {
    const protect = vi.fn(async () => {});
    const notes = new VaultCouncilTaskNotes(value.plugin, {
      assertReady: () => {},
      assertSource: () => {},
      protect,
      sources: new CouncilSourceNotes(value.app.vault, () => []),
      bindings: () => [
        {
          id: "legacy",
          path: "CoForge",
          projectId: value.projectId,
          teamId: "team",
          target: { kind: "council", id: "advice" },
          enabled: true,
          recursive: true,
          submit: "after-stable",
          settleMs: 0,
        },
      ],
    });
    const { question, ...metadata } = value.input;
    await expect(
      notes.create(
        {
          schema: "council-task/v1",
          ...metadata,
          createdAt: new Date().toISOString(),
        },
        question,
      ),
    ).rejects.toThrow(/watched inbox/iu);
    expect(protect).not.toHaveBeenCalled();
    expect(
      value.app.vault
        .getMarkdownFiles()
        .filter((item) => item.path.startsWith(COUNCIL_TASK_FOLDER + "/")),
    ).toHaveLength(0);
  } finally {
    await value.dispose();
  }
});

it("feeds the saved analytical note through existing reviewed preflight and executor-gated admission", async () => {
  const value = await fixture();
  try {
    const agent = (await value.module.actions.catalogue.list()).valid.find(
      (item) => item.definition.id === "agent",
    );
    if (!agent || agent.definition.schema !== "agent/v1")
      throw new Error("Missing test agent");
    await value.module.actions.catalogue.save(
      { ...agent.definition, provider: "claude" },
      agent.revision,
    );
    await value.studio.store.updateRuntime({ cliAvailable: true });
    const task = await value.module.actions.createTask(value.input);
    const original = value.kit.read(task.path);
    const preview = await value.module.actions.preflight(
      value.input.target,
      task.path,
    );
    expect(preview.source.sourceId).toBe(task.sourceId);
    expect(preview.source.markdown).toContain(value.input.question);
    expect(value.module.actions.snapshot().runs).toHaveLength(0);
    await expect(
      value.module.actions.submit(
        value.input.target,
        task.path,
        reviewedCouncilIdentity(preview),
      ),
    ).rejects.toThrow(/Designate/iu);
    await value.module.actions.designateExecutor();
    const run = await value.module.actions.submit(
      value.input.target,
      task.path,
      reviewedCouncilIdentity(preview),
    );
    expect(run.subject).toMatchObject({
      kind: "note",
      sourceId: task.sourceId,
    });
    expect(run.attempts).toHaveLength(0);
    expect(run.state).toBe("queued");
    expect(value.kit.read(task.path)).toBe(original);
    expect(
      await value.module.actions.submit(
        value.input.target,
        task.path,
        reviewedCouncilIdentity(preview),
      ),
    ).toMatchObject({ id: run.id });
    expect(value.module.actions.snapshot().runs).toHaveLength(1);
  } finally {
    await value.dispose();
  }
});
