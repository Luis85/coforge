import { describe, expect, it } from "vitest";
import { StudioStore } from "../../../features/coforge/application/studio-store";
import { workflowMetadataFingerprint } from "../../../features/coforge/application/workflow-note-integrity";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import {
  workflowProposalRevision,
  type WorkflowRun,
} from "../../../features/coforge/domain/configured-workflow-run";
import { seededStore } from "./memory-storage";

async function fixture() {
  const f = await seededStore();
  const idea = f.store.snapshot().ideas.find((idea) => idea.id === "CF-107")!;
  const now = new Date().toISOString();
  const definition = defaultWorkflowDefinition(f.store.snapshot().settings);
  definition.steps = [
    {
      id: "review",
      name: "Review",
      kind: "approval",
      instructions: "Review the proposal.",
    },
  ];
  const run: WorkflowRun = {
    id: "run-one",
    ideaId: idea.id,
    projectId: idea.projectId!,
    definition,
    proposalRevision: workflowProposalRevision(idea),
    revision: 1,
    cursor: 0,
    state: "waiting-human",
    attempts: [
      {
        id: "manual-one",
        stepId: "review",
        stepName: "Review",
        kind: "approval",
        status: "waiting-human",
        inputs: [],
        startedAt: now,
      },
    ],
    activeAttemptId: "manual-one",
    artifacts: [],
    createdAt: now,
    updatedAt: now,
  };
  await f.store.transaction((state) => {
    state.ideas.find((item) => item.id === idea.id)!.workflowRun = run;
  });
  return { ...f, ideaId: idea.id };
}
describe("private integrity anchors for note-backed workflow progress", () => {
  it("preserves trusted manual waiting progress across reload", async () => {
    const { storage, ideaId } = await fixture();
    const reloaded = new StudioStore(storage);
    await reloaded.init();
    expect(
      reloaded.snapshot().ideas.find((idea) => idea.id === ideaId)?.workflowRun
        ?.state,
    ).toBe("waiting-human");
  });
  it("stops externally forged progress even when its public corruption hashes could be recomputed", async () => {
    const { storage, ideaId } = await fixture();
    const loaded = await storage.load();
    const run = loaded.notes.find((idea) => idea.id === ideaId)!.workflowRun!;
    run.cursor = 1;
    run.state = "finished";
    const reloaded = new StudioStore({
      load: async () => loaded,
      save: async () => {},
    });
    await reloaded.init();
    const restored = reloaded
      .snapshot()
      .ideas.find((idea) => idea.id === ideaId)!.workflowRun!;
    expect(restored.state).toBe("stopped");
    expect(restored.error).toContain("changed outside CoForge");
    expect(restored.activeAttemptId).toBeUndefined();
    expect(restored.attempts[0]?.status).toBe("cancelled");
  });
  it("ignores property order while retaining captured bytes in the private anchor", async () => {
    const { store, ideaId } = await fixture();
    const run = store
      .snapshot()
      .ideas.find((idea) => idea.id === ideaId)!.workflowRun!;
    const reordered = Object.fromEntries(Object.entries(run).reverse());
    expect(workflowMetadataFingerprint({ workflowRun: run })).toBe(
      workflowMetadataFingerprint({ workflowRun: { ...run, ...reordered } }),
    );
    const changed = structuredClone(run);
    changed.definition.steps[0]!.instructions += "\nDifferent instructions";
    expect(workflowMetadataFingerprint({ workflowRun: changed })).not.toBe(
      workflowMetadataFingerprint({ workflowRun: run }),
    );
  });
});
