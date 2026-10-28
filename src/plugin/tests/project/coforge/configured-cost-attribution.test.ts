import { expect, it } from "vitest";
import { aiCostTaskCheck } from "../../../features/coforge/domain/ai-costs";
import { collectCostTasks } from "../../../features/coforge/domain/ai-cost-snapshot";
import { createSeed } from "../../../features/coforge/domain/seed";
import type { ConfiguredStepExecution } from "../../../features/coforge/domain/configured-workflow-run";
it("retains separate attempt costs and immutable step identity when workflows are renamed, reordered or removed", () => {
  const state = createSeed();
  const workflow: ConfiguredStepExecution = {
    runId: "run-one",
    definitionRevision: "revision-one",
    proposalRevision: "proposal-one",
    attemptId: "attempt-one",
    inputArtifacts: [],
    step: {
      id: "research-custom",
      name: "Research alternatives",
      instructions: "Research",
      kind: "ai",
      output: "markdown",
      access: "none",
      provider: "claude",
      model: "test-model",
      automatic: false,
    },
  };
  state.jobs = [
    {
      id: "job-one",
      ideaId: state.ideas[0]!.id,
      projectId: state.ideas[0]!.projectId,
      stage: "plan",
      status: "failed",
      provider: "claude",
      model: "test-model",
      workflow,
      startedAt: "2026-10-28T00:00:00Z",
      logs: [],
      costUsd: 0.1,
      usage: { inputTokens: 12, outputTokens: 2 },
    },
    {
      id: "job-two",
      ideaId: state.ideas[0]!.id,
      projectId: state.ideas[0]!.projectId,
      stage: "plan",
      status: "succeeded",
      provider: "claude",
      model: "test-model",
      workflow: { ...workflow, attemptId: "attempt-two" },
      startedAt: "2026-10-28T00:01:00Z",
      logs: [],
      costUsd: 0.2,
      usage: { inputTokens: 5, outputTokens: 3 },
    },
  ];
  const tasks = collectCostTasks(state, []);
  expect(tasks.map((task) => task.id)).toEqual(["job:job-one", "job:job-two"]);
  expect(tasks.map((task) => task.workflow?.attemptId)).toEqual([
    "attempt-one",
    "attempt-two",
  ]);
  expect(tasks[0]?.workflow).toEqual({
    runId: "run-one",
    definitionRevision: "revision-one",
    stepId: "research-custom",
    stepName: "Research alternatives",
    attemptId: "attempt-one",
  });
  workflow.step.name = "Renamed later";
  expect(tasks[0]?.workflow?.stepName).toBe("Research alternatives");
  expect(
    aiCostTaskCheck(JSON.parse(JSON.stringify(tasks[0]))).workflow,
  ).toEqual(tasks[0]?.workflow);
  expect(tasks[0]?.usage).toEqual({ inputTokens: 12, outputTokens: 2 });
});
