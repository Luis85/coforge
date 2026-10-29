// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { stringifyYaml } from "obsidian";
import { CouncilModule } from "../../../infrastructure/coforge/council-module";
import { InvocationGate } from "../../../features/coforge/application/invocation-gate";
import { defaultCouncilDefinition } from "../../../features/coforge/domain/council-definitions";
import { councilIdeaRevision } from "../../../features/coforge/application/council-linked-idea";
import { councilAdmission } from "../../../features/coforge/application/council-execution";
import {
  ideaBody,
  ideaProperties,
} from "../../../features/coforge/domain/idea-note";
import { councilControlsFixture } from "./council-controls-fixture";
import { nodeTimers } from "./memory-storage";

async function fixture() {
  const f = await councilControlsFixture(false);
  await f.studio.store.transaction(state => {
    const item = state.ideas.find(item => item.status === "shipped")!;
    item.requestObject = { className: "Business Idea", fields: [{ key: "value", label: "Business value", type: "number" }], values: { value: 42 } };
  });
  const idea = f.studio
    .state()
    .ideas.find((item) => item.status === "shipped")!;
  await f.app.vault.createFolder("Requests");
  const file = await f.app.vault.create(
    "Requests/Item.md",
    `---\n${stringifyYaml(ideaProperties(idea, "Player"))}---\n${ideaBody(idea)}`,
  );
  const team = (await f.module.actions.catalogue.list()).valid.find(
    (item) => item.definition.id === "team",
  )?.definition;
  if (!team || team.schema !== "team/v1") throw new Error("Missing team");
  await f.module.actions.catalogue.save(
    defaultCouncilDefinition("advice", "Advice", team, team.members),
  );
  await f.module.dispose();
  const module = new CouncilModule(
    f.plugin,
    f.studio,
    nodeTimers(),
    new InvocationGate(),
    undefined,
    (id) => (id === idea.id ? file : null),
  );
  await module.start();
  const input = {
    projectId: f.projectId,
    target: { kind: "council" as const, id: "advice", teamId: "team" },
    title: "Assess request",
    question: "What are its next steps and open gaps?",
    idempotencyKey: "linked-assessment",
    linkedIdea: { ideaId: idea.id, revision: councilIdeaRevision(idea) },
  };
  return {
    ...f,
    module,
    idea,
    file,
    input,
    async dispose() {
      await module.dispose();
      await f.dispose();
    },
  };
}

it("saves canonical assessment context without admission and preserves linked identity through preflight and simulation", async () => {
  const f = await fixture();
  try {
    const task = await f.module.actions.createTask(f.input);
    expect(task.linkedIdea).toEqual(f.input.linkedIdea);
    expect(f.kit.read(task.path)).toContain("Captured request context");
    expect(f.kit.read(task.path)).toContain('"className": "Business Idea"');
    expect(f.kit.read(task.path)).toContain('"value": 42');
    expect(f.kit.read(task.path)).not.toContain('"diff"');
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
    await f.studio.store.transaction((state) => {
      const item = state.ideas.find((item) => item.id === f.idea.id)!;
      item.voters.push("private-new-voter");
      item.updatedAt = new Date().toISOString();
    });
    expect(await f.module.actions.createTask(f.input)).toEqual(task);
    const before = JSON.stringify(f.studio.state().ideas);
    const preview = await f.module.actions.preflight(f.input.target, task.path);
    expect(preview.source.linkedIdea).toEqual(f.input.linkedIdea);
    expect(
      councilAdmission(preview, "run", "key", {
        simulation: true,
        maxTurns: 10,
        maxBudgetUsd: 1,
        timeoutSeconds: 30,
      }).subject,
    ).toMatchObject({
      kind: "idea",
      ideaId: f.idea.id,
      ideaRevision: f.input.linkedIdea.revision,
    });
    await f.module.actions.designateExecutor();
    const run = await f.module.actions.simulate(
      f.input.target,
      task.path,
      "CoForge/Tests/Assessment.md",
    );
    expect(run.subject).toMatchObject({
      kind: "idea",
      ideaId: f.idea.id,
      ideaRevision: f.input.linkedIdea.revision,
    });
    expect(
      f.studio.state().ideas.find((item) => item.id === f.idea.id)?.status,
    ).toBe("shipped");
    expect(f.kit.read(task.path)).not.toContain("private-new-voter");
    expect(JSON.stringify(f.studio.state().ideas)).toBe(before);
  } finally {
    await f.dispose();
  }
});

it("blocks canonical note edits and metadata removal, including an otherwise generic-note submission", async () => {
  const f = await fixture();
  try {
    const task = await f.module.actions.createTask(f.input);
    const taskFile = f.app.vault.getFileByPath(task.path)!;
    const original = f.kit.read(task.path);
    await f.app.vault.modify(
      taskFile,
      original
        .replace(/    ideaId:.*\n    revision:.*\n/u, "")
        .replace(/  linkedIdea:\n/u, ""),
    );
    await expect(
      f.module.actions.preflight(f.input.target, task.path),
    ).rejects.toThrow(/metadata|identity/i);
    await f.app.vault.modify(taskFile, "A generic note with all linked metadata and markers removed.");
    await expect(f.module.actions.preflight(f.input.target, task.path)).rejects.toThrow(/identity|project|metadata/i);
    await f.app.vault.modify(taskFile, original);
    await f.app.vault.modify(
      f.file,
      f.kit.read(f.file.path).replace(f.idea.title, "A changed request"),
    );
    await expect(
      f.module.actions.preflight(f.input.target, task.path),
    ).rejects.toThrow(/canonical request changed/i);
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally {
    await f.dispose();
  }
});

it("checks the current canonical item again before provider entry after admission, without replay or item mutation", async () => {
  const f = await fixture();
  try {
    const task = await f.module.actions.createTask(f.input);
    await f.module.actions.designateExecutor();
    const run = await f.module.actions.simulate(
      f.input.target,
      task.path,
      "CoForge/Tests/Assessment.md",
    );
    await f.app.vault.modify(
      f.file,
      f.kit.read(f.file.path).replace(f.idea.title, "A changed request"),
    );
    await f.module.actions.resume();
    await expect
      .poll(
        () =>
          f.module.actions.snapshot().runs.find((item) => item.id === run.id)
            ?.state,
      )
      .toBe("attention");
    const retained = f.module.actions
      .snapshot()
      .runs.find((item) => item.id === run.id)!;
    expect(retained.artifacts).toHaveLength(0);
    expect(
      retained.attempts.every((attempt) => attempt.status !== "published"),
    ).toBe(true);
    expect(
      f.studio.state().ideas.find((item) => item.id === f.idea.id)?.status,
    ).toBe("shipped");
  } finally {
    await f.dispose();
  }
});
