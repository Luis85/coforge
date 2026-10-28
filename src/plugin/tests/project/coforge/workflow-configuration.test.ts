import { describe, expect, it } from "vitest";
import { saveProjectWorkflow } from "../../../features/coforge/application/workflow-configuration";
import { workflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { seededStore } from "./memory-storage";

describe("atomic project workflow configuration", () => {
  it("saves only the addressed project with a fresh revision and rejects stale replacement", async () => {
    const { store, storage } = await seededStore();
    const projectId = store.snapshot().activeProjectId!;
    const original = workflowDefinition(store.snapshot().settings);
    const identity = JSON.stringify(original);
    const saved = await saveProjectWorkflow(
      store,
      projectId,
      { ...original, name: "Design and review" },
      identity,
    );
    expect(saved.settings.workflow?.name).toBe("Design and review");
    expect(saved.settings.workflow?.revision).not.toBe(original.revision);
    expect(store.snapshot().settings.workflow).toEqual(saved.settings.workflow);
    const writes = storage.saves;
    await expect(
      saveProjectWorkflow(store, projectId, original, identity),
    ).rejects.toThrow("draft was preserved");
    expect(storage.saves).toBe(writes);
    expect(store.snapshot().settings.workflow).toEqual(saved.settings.workflow);
  });
  it("keeps the old run definition and queued attempt while saving a new definition for future runs", async () => {
    const { store } = await seededStore();
    const projectId = store.snapshot().activeProjectId!;
    const original = workflowDefinition(store.snapshot().settings);
    const now = new Date().toISOString();
    const run: WorkflowRun = {
      id: "run-one",
      ideaId: "CF-107",
      projectId,
      definition: original,
      proposalRevision: "proposal-one",
      revision: 1,
      cursor: 0,
      state: "ready",
      attempts: [],
      artifacts: [],
      createdAt: now,
      updatedAt: now,
    };
    await store.transaction((state) => {
      state.ideas.find((idea) => idea.id === "CF-107")!.workflowRun = run;
    });
    await saveProjectWorkflow(
      store,
      projectId,
      { ...original, steps: original.steps.slice().reverse() },
      JSON.stringify(original),
    );
    expect(
      store.snapshot().ideas.find((idea) => idea.id === "CF-107")?.workflowRun
        ?.definition,
    ).toEqual(original);
    expect(store.snapshot().settings.workflow?.steps[0]?.id).toBe("implement");
  });
  it("publishes no event or canonical configuration when persistence fails", async () => {
    const { store, storage } = await seededStore();
    const original = workflowDefinition(store.snapshot().settings);
    const events: string[] = [];
    store.subscribeEvents((event) => {
      events.push(event.type);
    });
    storage.failNextSave = true;
    await expect(
      saveProjectWorkflow(
        store,
        store.snapshot().activeProjectId!,
        original,
        JSON.stringify(original),
      ),
    ).rejects.toThrow("Disk full");
    expect(store.snapshot().settings.workflow).toBeUndefined();
    expect(events).toEqual([]);
  });
});
