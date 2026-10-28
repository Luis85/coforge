import type { ExecutionRun } from "../domain/execution-run";
import type { StudioProject } from "../domain/types";
import { contextEventId } from "../domain/integrity";
import type { AICostTask } from "../domain/ai-costs";

/** Telemetry has host/provider provenance; no cost is inferred from model prose or absent counters. */
export function executionCostTasks(
  runs: readonly ExecutionRun[],
  projects: readonly StudioProject[],
): AICostTask[] {
  return runs.flatMap((run) =>
    run.attempts
      .filter((attempt) => !attempt.skipped)
      .map((attempt) => {
        const invocation = run.invocations.find(
          (item) => item.id === attempt.invocationId,
        )!;
        const artifact = run.artifacts.find(
          (item) => item.attemptId === attempt.id,
        );
        const usage = artifact?.usage ?? attempt.usage;
        const reportedUsd = artifact?.costUsd ?? attempt.costUsd;
        return {
          id: `execution-${attempt.id}`,
          featureId: run.subject.sourceId,
          featureTitle: `Note ${run.subject.sourceId}`,
          projectId: run.projectId,
          projectName:
            projects.find((project) => project.id === run.projectId)?.settings
              .projectName ?? "",
          provider: invocation.provider,
          model: invocation.model,
          stage: "council",
          status: attempt.status,
          startedAt: attempt.startedAt,
          ...(artifact ? { finishedAt: artifact.createdAt } : {}),
          ...(reportedUsd !== undefined ? { reportedUsd } : {}),
          ...(usage ? { usage, usageSource: "provider" as const } : {}),
          workflow: {
            runId: run.id,
            definitionRevision: contextEventId(run.definitionSnapshot ?? ""),
            stepId: contextEventId(invocation.id),
            stepName: invocation.roundId,
            attemptId: attempt.id,
          },
        };
      }),
  );
}
