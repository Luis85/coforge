import { expect, it } from "vitest";
import { executionCostTasks } from "../../../features/coforge/application/execution-costs";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";

it("retains provider telemetry for uncertain attempts and leaves missing costs unknown", () => {
  const run: ExecutionRun = {
    id: "run",
    submissionKey: "key",
    subject: {
      kind: "note",
      sourceId: "source",
      revision: "rev",
      markdown: "private input",
    },
    projectId: "project",
    teamId: "team",
    context: "",
    cursor: 0,
    state: "attention",
    createdAt: "2026-10-28T10:00:00Z",
    updatedAt: "2026-10-28T10:00:01Z",
    invocations: [
      {
        id: "opinion-a",
        roundId: "opinion",
        agentId: "a",
        agentRevision: "r",
        provider: "claude",
        model: "sonnet",
        instructions: "private prompt",
        access: "none",
        inputRoundIds: [],
      },
    ],
    attempts: [
      {
        id: "attempt",
        invocationId: "opinion-a",
        startedAt: "2026-10-28T10:00:00Z",
        status: "unknown",
        dispatch: { prompt: "private", inputArtifactIds: [] },
        costUsd: 0.02,
        usage: { inputTokens: 5, outputTokens: 2 },
      },
      {
        id: "retry",
        invocationId: "opinion-a",
        startedAt: "2026-10-28T10:00:01Z",
        status: "unknown",
        dispatch: { prompt: "private", inputArtifactIds: [] },
      },
    ],
    artifacts: [],
  };
  const tasks = executionCostTasks([run], []);
  expect(tasks[0]).toMatchObject({
    id: "execution-attempt",
    reportedUsd: 0.02,
    usageSource: "provider",
    usage: { inputTokens: 5, outputTokens: 2 },
  });
  expect(tasks[1]?.reportedUsd).toBeUndefined();
  expect(JSON.stringify(tasks)).not.toContain("private");
});
