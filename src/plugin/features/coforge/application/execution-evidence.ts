import {
  emptyExecutionMessagingState,
  type ExecutionMessagingState,
} from "../domain/execution-outbox";
import { stageUsageCheck, type StageUsage } from "../domain/ai-usage";
import { number } from "../domain/check";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import { executionContributionBlock } from "../domain/execution-projection";
import { contextEventId } from "../domain/integrity";

export class ExecutionEvidence {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
  ) {}
  async updateMessaging(
    work: (state: ExecutionMessagingState) => ExecutionMessagingState,
  ): Promise<void> {
    await this.store.mutate((next) => {
      next.messaging = work(
        structuredClone(next.messaging ?? emptyExecutionMessagingState()),
      );
    });
  }
  /** Host telemetry remains attributable even when an invocation subsequently fails or is cancelled. */
  async recordTelemetry(
    runId: string,
    attemptId: string,
    usage?: StageUsage,
    costUsd?: number,
  ): Promise<void> {
    const checkedUsage =
      usage === undefined ? undefined : stageUsageCheck(usage);
    const checkedCost =
      costUsd === undefined ? undefined : number({ min: 0 })(costUsd);
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === runId);
      const attempt = run?.attempts.find((item) => item.id === attemptId);
      if (!run || !attempt)
        throw new Error(
          "Telemetry must identify its original retained attempt.",
        );
      if (attempt.status === "not-started") throw new Error("A provider was not contacted for this attempt; telemetry is unavailable.");
      if (checkedUsage) {
        attempt.usage = { ...attempt.usage, ...checkedUsage };
        attempt.usageSource = "provider";
      }
      if (checkedCost !== undefined) attempt.costUsd = checkedCost;
    });
  }
  exportRun(id: string): string {
    this.store.assertLoaded();
    return JSON.stringify(
      {
        format: "coforge-execution-export/v2",
        exportedAt: this.host.now(),
        run: structuredClone(this.store.find(id)),
      },
      null,
      2,
    );
  }
  async pruneRun(id: string): Promise<void> {
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      if (
        !run ||
        !["completed", "cancelled"].includes(run.state) ||
        run.projectionRecovery || run.timing?.active || run.timing?.parallel?.length ||
        run.attempts.some((attempt) =>
          ["dispatching", "unknown", "responded"].includes(attempt.status),
        ) ||
        next.messaging?.outbox.some(
          (entry) => entry.message.runId === id && entry.status !== "delivered",
        )
      )
        throw new Error(
          "Retain active, uncertain or unpublished evidence and pending message deliveries. Only settled terminal histories can be pruned.",
        );
      const destinations = [
        ...new Set([
          run.subject.sourceId,
          ...(run.projectionDestinations ?? []),
          ...(run.projectionTarget ? [run.projectionTarget.sourceId] : []),
        ]),
      ];
      const projections = next.projections ?? [];
      for (const sourceId of destinations)
        for (const artifact of run.artifacts) {
          const blockHash = contextEventId(
            executionContributionBlock(run, artifact),
          );
          const existing = projections.find(
            (item) =>
              item.sourceId === sourceId && item.artifactId === artifact.id,
          );
          if (existing && existing.blockHash !== blockHash)
            throw new Error(
              "Preserve conflicting projection evidence before pruning.",
            );
          if (!existing)
            projections.push({ sourceId, artifactId: artifact.id, blockHash });
        }
      next.projections = projections;
      if (run.state === "cancelled")
        next.cancelledRunIds = [
          ...new Set([...(next.cancelledRunIds ?? []), run.id]),
        ];
      next.runs = next.runs.filter((item) => item.id !== id);
      // Submission tombstones are intentionally permanent: pruning readable history never re-admits the old note.
    });
  }
}
