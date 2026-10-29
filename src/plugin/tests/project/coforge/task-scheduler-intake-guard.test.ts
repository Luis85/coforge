// @vitest-environment happy-dom
import { TaskScheduler } from "../../../features/coforge/application/task-scheduler";
import {
  emptyTaskScheduler,
  type TaskSchedulerState,
} from "../../../features/coforge/domain/scheduled-task";
import { nodeTimers } from "./memory-storage";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { taskSchedulerHost } from "../../../infrastructure/coforge/task-scheduler-host";
import { CouncilStateStorage } from "../../../infrastructure/coforge/council-state-storage";
import {
  SCHEDULED_TASK_FOLDER,
  scheduledOccurrencePath,
  type TaskDraft,
  type TaskOccurrence,
} from "../../../features/coforge/domain/scheduled-task";
import type { IntakeBinding } from "../../../features/coforge/domain/intake-bindings";
import { councilControlsFixture } from "./council-controls-fixture";
async function fixture() {
  const f = await councilControlsFixture();
  const agent = (await f.module.actions.catalogue.list()).valid.find(
    (entry) =>
      entry.definition.id === f.target.id &&
      entry.definition.schema === "agent/v1",
  );
  if (!agent || agent.definition.schema !== "agent/v1")
    throw new Error("Expected fixture agent");
  await f.module.actions.catalogue.save(
    { ...agent.definition, provider: "claude" },
    agent.revision,
  );
  await f.studio.store.updateRuntime({ cliAvailable: true });
  const storage = new CouncilStateStorage(f.plugin);
  const task: TaskDraft = {
    title: "Review a scheduled question",
    projectId: f.projectId,
    prompt: "Give advice without starting implementation.",
    contextPaths: [],
    destination: { kind: "agent", id: f.target.id, teamId: f.target.teamId },
    timing: { kind: "once", at: new Date(Date.now() + 60000).toISOString() },
    enabled: true,
  };
  const occurrence: TaskOccurrence = {
    id: "legacy-guard",
    taskId: "schedule-one",
    taskRevision: 1,
    dueAt: Date.now(),
    createdAt: Date.now(),
    status: "reserved",
    message: "Reserved",
    snapshot: task,
  };
  const binding = (
    path: string,
    recursive: boolean,
    enabled = true,
  ): IntakeBinding => ({
    id: "legacy-watch",
    path,
    recursive,
    enabled,
    projectId: f.projectId,
    teamId: f.target.teamId,
    target: { kind: f.target.kind, id: f.target.id },
    settleMs: 0,
    submit: "after-stable",
  });
  // Persist a structurally valid historical binding without passing today's editor folder policy.
  const savedBinding = async (value: IntakeBinding) => {
    const previous = await storage.preferences();
    await storage.savePreferences(
      { ...previous, revision: previous.revision + 1, bindings: [value] },
      previous.revision,
    );
    return f.app.vault.adapter.read(
      `${storage.directory}/coforge-council-settings.json`,
    );
  };
  return {
    ...f,
    task,
    occurrence,
    binding,
    savedBinding,
    host: taskSchedulerHost(f.plugin, f.studio, f.module.actions),
    preferencesPath: `${storage.directory}/coforge-council-settings.json`,
  };
}
it.each([
  ["recursive parent", "CoForge", true],
  ["nested output scope", SCHEDULED_TASK_FOLDER, false],
  ["case variant", "coforge/scheduled tasks", true],
] as const)(
  "blocks a legacy %s inbox before source creation or admission and preserves preferences",
  async (_label, path, recursive) => {
    const f = await fixture();
    try {
      const bytes = await f.savedBinding(f.binding(path, recursive));
      await expect(
        f.host.dispatch(f.task, f.occurrence, new AbortController().signal),
      ).rejects.toThrow(/watched inbox/iu);
      expect(
        f.app.vault.getAbstractFileByPath(
          scheduledOccurrencePath(f.occurrence.id),
        ),
      ).toBeNull();
      expect(f.module.actions.snapshot().runs).toHaveLength(0);
      expect(await f.app.vault.adapter.read(f.preferencesPath)).toBe(bytes);
    } finally {
      await f.dispose();
    }
  },
);
it.each([
  ["unrelated folder", "Private/Inbox", true, true],
  ["nonrecursive parent", "CoForge", false, true],
  ["deeper nested folder", SCHEDULED_TASK_FOLDER + "/Nested", true, true],
  ["disabled direct folder", SCHEDULED_TASK_FOLDER, true, false],
] as const)(
  "allows a %s binding that cannot ingest this scheduled source",
  async (_label, path, recursive, enabled) => {
    const f = await fixture();
    try {
      const bytes = await f.savedBinding(f.binding(path, recursive, enabled));
      const receipt = await f.host.dispatch(
        f.task,
        f.occurrence,
        new AbortController().signal,
      );
      expect(receipt.sourcePath).toBe(scheduledOccurrencePath(f.occurrence.id));
      expect(f.module.actions.snapshot().runs).toHaveLength(1);
      expect(await f.app.vault.adapter.read(f.preferencesPath)).toBe(bytes);
    } finally {
      await f.dispose();
    }
  },
);
it.each(["source write", "preflight"] as const)(
  "rechecks changed saved bindings after awaited %s and holds before explicit submission",
  async (stage) => {
    const f = await fixture();
    try {
      const create = f.app.vault.create.bind(f.app.vault);
      let bytes = "";
      if (stage === "source write")
        vi.spyOn(f.app.vault, "create").mockImplementation(async (...args) => {
          const file = await create(...args);
          if (file.path === scheduledOccurrencePath(f.occurrence.id))
            bytes = await f.savedBinding(
              f.binding(SCHEDULED_TASK_FOLDER, true),
            );
          return file;
        });
      if (stage === "preflight") {
        const preflight = f.module.actions.preflight.bind(f.module.actions);
        vi.spyOn(f.module.actions, "preflight").mockImplementation(
          async (...args) => {
            const preview = await preflight(...args);
            bytes = await f.savedBinding(
              f.binding(SCHEDULED_TASK_FOLDER, true),
            );
            return preview;
          },
        );
      }
      await expect(
        f.host.dispatch(f.task, f.occurrence, new AbortController().signal),
      ).rejects.toThrow(/watched inbox/iu);
      expect(f.kit.read(scheduledOccurrencePath(f.occurrence.id))).toContain(
        f.task.prompt,
      );
      expect(f.module.actions.snapshot().runs).toHaveLength(0);
      expect(await f.app.vault.adapter.read(f.preferencesPath)).toBe(bytes);
    } finally {
      await f.dispose();
    }
  },
);

it.each(["policy", "I/O"] as const)(
  "retains the safe %s failure reason and recovery gate in the durable occurrence",
  async (kind) => {
    const f = await fixture();
    let scheduler: TaskScheduler | undefined;
    try {
      await f.module.actions.resume();
      if (kind === "policy")
        await f.savedBinding(f.binding(SCHEDULED_TASK_FOLDER, true));
      else {
        const create = f.app.vault.create.bind(f.app.vault);
        vi.spyOn(f.app.vault, "create").mockImplementation(async (...args) => {
          if (
            args[0].startsWith(SCHEDULED_TASK_FOLDER + "/") &&
            args[0].endsWith(".md")
          )
            throw new Error("PRIVATE_DISK_FAILURE_DETAIL");
          return create(...args);
        });
      }
      let state: TaskSchedulerState = emptyTaskScheduler();
      scheduler = new TaskScheduler(
        {
          load: async () => structuredClone(state),
          save: async (value) => {
            state = structuredClone(value);
          },
        },
        f.host,
        nodeTimers(),
      );
      await scheduler.start();
      const task = await scheduler.save(f.task);
      await scheduler.runNow(task.id);
      const occurrence = scheduler.snapshot().occurrences[0]!;
      expect(occurrence.status).toBe("attention");
      expect(occurrence.message).toBe(
        kind === "policy"
          ? "A watched inbox would ingest this scheduled source. Move or remove the overlapping inbox binding, then inspect this occurrence before enabling future scheduling. Saved inbox preferences were preserved."
          : "Admission could not be confirmed. Inspect this occurrence and its source/run before enabling the schedule again; no automatic retry.",
      );
      expect(occurrence.message).not.toContain("PRIVATE_DISK_FAILURE_DETAIL");
      expect(scheduler.snapshot().tasks[0]?.enabled).toBe(false);
      expect(f.module.actions.snapshot().runs).toHaveLength(0);
      await expect(scheduler.runNow(task.id)).rejects.toThrow("acknowledge");
    } finally {
      await scheduler?.dispose();
      await f.dispose();
    }
  },
);
