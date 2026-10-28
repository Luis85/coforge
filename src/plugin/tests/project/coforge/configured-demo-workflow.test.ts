import { expect, it } from "vitest";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { WorkflowEngine } from "../../../features/coforge/application/engine";
import { defaultWorkflowDefinition } from "../../../features/coforge/domain/configured-workflow";
import { nodeTimers, seededStore } from "./memory-storage";

it("executes custom Markdown and manual steps with the actual simulation runner without inventing implementation", async () => {
  const { store } = await seededStore();
  const definition = defaultWorkflowDefinition(store.snapshot().settings);
  definition.steps = [
    {
      id: "research",
      name: "Research",
      kind: "ai",
      output: "markdown",
      access: "none",
      provider: "demo",
      model: "sonnet",
      instructions: "Research this proposal.",
      automatic: true,
    },
    {
      id: "confirm",
      name: "Check the idea",
      kind: "checklist",
      instructions: "Read the findings.",
      items: [{ id: "read", label: "I reviewed the findings", required: true }],
    },
    {
      id: "refine",
      name: "Refine the proposal",
      kind: "ai",
      output: "markdown",
      access: "none",
      provider: "demo",
      model: "sonnet",
      instructions: "Refine the proposal.",
      automatic: true,
      inputs: ["markdown"],
    },
  ];
  await store.transaction((state) => {
    state.settings.workflow = definition;
    state.settings.paused = false;
  });
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [0, 0]);
  const engine = new WorkflowEngine(store, {
    runners: { demo: runner, claude: runner },
    timers,
  });
  try {
    await engine.startWorkflow("CF-107");
    await engine.waitUntilIdle();
    const waiting = store
      .snapshot()
      .ideas.find((idea) => idea.id === "CF-107")!.workflowRun!;
    expect(waiting.state).toBe("waiting-human");
    expect(waiting.artifacts[0]?.markdown).toContain("Simulated Research");
    await expect(
      engine.completeWorkflowManual("CF-107", waiting.revision, []),
    ).rejects.toThrow("required");
    await engine.completeWorkflowManual("CF-107", waiting.revision, ["read"]);
    await engine.waitUntilIdle();
    const idea = store.snapshot().ideas.find((idea) => idea.id === "CF-107")!;
    expect(idea.workflowRun?.state).toBe("finished");
    expect(
      idea.workflowRun?.artifacts.map((artifact) => artifact.output),
    ).toEqual(["markdown", "markdown"]);
    expect(idea.workflowRun?.attempts.map((attempt) => attempt.status)).toEqual(
      ["succeeded", "succeeded", "succeeded"],
    );
    expect(idea.increment).toBeUndefined();
    expect(idea.status).toBe("inbox");
    expect(store.snapshot().jobs).toHaveLength(2);
    expect(store.snapshot().population?.counters["job-completed"]).toBe(2);
    expect(
      store.snapshot().population?.counters["workflow-manual-completed"],
    ).toBe(1);
  } finally {
    await engine.stop();
  }
});
