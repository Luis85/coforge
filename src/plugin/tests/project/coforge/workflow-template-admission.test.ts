import { expect, it, vi } from "vitest";
import { WorkflowEngine } from "../../../features/coforge/application/engine";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import type { WorkflowOutputTemplateActions } from "../../../features/coforge/application/workflow-output-templates";
import { ai, definition } from "./configured-workflow-fixture";
import { nodeTimers, seededStore } from "./memory-storage";

it.each(["missing", "unreadable"])(
  "holds %s template admission durably without a fabricated run and permits explicit retry after repair",
  async (failure) => {
    const { store, storage } = await seededStore();
    await store.transaction((state) => {
      state.ideas = [state.ideas.find((idea) => idea.status === "inbox")!];
      state.settings.workflow = definition([
        { ...ai("answer"), outputTemplateId: "answer-template" },
      ]);
      state.settings.paused = false;
    });
    const idea = store.snapshot().ideas[0]!;
    const beforeJobs = store.snapshot().jobs;
    let ready = false;
    const list = vi.fn(async (projectId: string) => {
      if (!ready && failure === "unreadable")
        throw new Error("Cannot read /private/vault/note.md");
      return {
        templates: ready
          ? [
              {
                id: "answer-template",
                projectId,
                name: "Answer",
                markdown: "# Answer",
                revision: "revision",
              },
            ]
          : [],
        invalid: [],
      };
    });
    const templates: WorkflowOutputTemplateActions = {
      list,
      save: async () => {
        throw new Error("Unexpected save");
      },
      remove: async () => undefined,
      open: async () => undefined,
    };
    const runner = vi.fn(async () => ({ markdown: "# Completed" }));
    const engine = new WorkflowEngine(store, {
      outputTemplates: templates,
      runners: { demo: runner, claude: runner },
      timers: nodeTimers(),
    });
    try {
      expect(await engine.tick(false)).toBeNull();
      const held = store.snapshot().ideas[0]!;
      expect(held.workflowRun).toBeUndefined();
      expect(held.lastError).toMatch(/output template/i);
      expect(held.lastError).not.toContain("/private");
      expect(store.snapshot().jobs).toEqual(beforeJobs);
      expect(store.snapshot().population?.operations).toContainEqual(
        expect.objectContaining({
          code: "workflow-admission-blocked",
          entityId: idea.id,
          effect: "committed",
        }),
      );
      expect(runner).not.toHaveBeenCalled();
      const reloaded = new StudioStore(storage);
      await reloaded.init();
      expect(reloaded.snapshot().ideas[0]?.lastError).toBe(held.lastError);
      expect(await engine.tick(false)).toBeNull();
      expect(list).toHaveBeenCalledTimes(1);
      ready = true;
      await engine.runWorkflowStep(idea.id);
      await engine.waitUntilIdle();
      expect(store.snapshot().ideas[0]?.lastError).toBeUndefined();
      expect(store.snapshot().ideas[0]?.workflowRun?.state).toBe("finished");
      expect(runner).toHaveBeenCalledTimes(1);
    } finally {
      await engine.stop();
    }
  },
);
