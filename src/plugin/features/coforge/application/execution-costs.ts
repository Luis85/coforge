import type { ExecutionRun } from "../domain/execution-run";
import type { StudioProject } from "../domain/types";
import { contextEventId } from "../domain/integrity";
import type { AICostTask } from "../domain/ai-costs";
import type { MessageOutboxEntry } from '../domain/team-messages';
import { costAttributionForRun } from './execution-cost-attribution';

/** Telemetry has host/provider provenance; no cost is inferred from model prose or absent counters. */
export function executionCostTasks(
  runs: readonly ExecutionRun[],
  projects: readonly StudioProject[],
  messages: readonly MessageOutboxEntry[] = [],
): AICostTask[] {
  return runs.flatMap((run) => {
    const attribution = costAttributionForRun(run, messages);
    const heading = /^#\s+([^\r\n]+)/u.exec(run.subject.markdown.trimStart())?.[1]?.slice(0, 200);
    return run.attempts
      .filter((attempt) => !attempt.skipped)
      .map((attempt) => {
        const invocation = run.invocations.find(
          (item) => item.id === attempt.invocationId,
        )!;
        const artifact = run.artifacts.find(
          (item) => item.attemptId === attempt.id,
        );
        const usage = artifact?.usage || attempt.usage ? { ...attempt.usage, ...artifact?.usage } : undefined;
        const reportedUsd = artifact?.costUsd ?? attempt.costUsd;
        const attributed = attribution(invocation);
        const simulation = run.limits?.simulation === true || invocation.provider === 'demo';
        return {
          id: `execution-${attempt.id}`,
          attribution: attributed,
          featureId: run.subject.sourceId,
          featureTitle: heading || `Note ${run.subject.sourceId}`.slice(0, 200),
          projectId: run.projectId,
          projectName:
            projects.find((project) => project.id === run.projectId)?.settings
              .projectName ?? "",
          provider: simulation ? 'demo' : invocation.provider,
          model: invocation.model,
          stage: attributed.kind,
          status: attempt.status,
          startedAt: attempt.startedAt,
          ...(artifact ? { finishedAt: artifact.createdAt } : {}),
          ...(!simulation && reportedUsd !== undefined ? { reportedUsd } : {}),
          ...(!simulation && usage ? { usage, usageSource: "provider" as const } : {}),
          workflow: {
            runId: run.id,
            definitionRevision: contextEventId(run.definitionSnapshot ?? ""),
            stepId: contextEventId(invocation.id),
            stepName: invocation.roundId,
            attemptId: attempt.id,
          },
        };
      });
  });
}
