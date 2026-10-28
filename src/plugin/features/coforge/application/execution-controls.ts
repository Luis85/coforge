import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import { nextExecutionBoundary } from "./execution-boundaries";
import { executionDescendants } from "../domain/execution-lineage";

export class ExecutionControls {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly activeRunId: () => string | undefined,
  ) {}
  async retry(id: string, acknowledgeUnknown = false): Promise<void> {
    if (this.activeRunId() === id) throw new Error("Wait for all active round members to settle before retrying.");
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      if (!run || run.state !== "attention")
        throw new Error("Only an Attention run can be retried.");
      if (
        run.attempts.some(
          (item) =>
            item.status === "unknown" && !item.uncertaintyAcknowledgedAt,
        ) &&
        !acknowledgeUnknown
      )
        throw new Error(
          "Explicitly acknowledge the uncertain external outcome before retrying.",
        );
      if (acknowledgeUnknown)
        for (const attempt of run.attempts.filter(
          (item) => item.status === "unknown",
        ))
          attempt.uncertaintyAcknowledgedAt ??= this.host.now();
      run.state = "queued";
      delete run.reason;
      run.updatedAt = this.host.now();
    });
  }
  async cancel(id: string): Promise<void> {
    const cancelled = await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      if (!run || run.state === "completed")
        throw new Error("This execution cannot be cancelled.");
      const ids = executionDescendants(next, id);
      const incoming = new Set(
        next.runs
          .filter((item) => ids.has(item.id))
          .map((item) => item.subject.sourceId),
      );
      next.cancelledRunIds = [
        ...new Set([...(next.cancelledRunIds ?? []), ...ids]),
      ];
      for (const current of next.runs.filter((item) => ids.has(item.id)))
        if (current.state !== "completed") {
          current.state = "cancelled";
          current.reason =
            "Cancelled by the operator. Active external work may still require settlement.";
          current.updatedAt = this.host.now();
        }
      for (const root of next.messaging?.roots ?? [])
        if (root.id === id) root.stopped = true;
      for (const entry of next.messaging?.outbox ?? [])
        if (
          (ids.has(entry.message.runId) || incoming.has(entry.message.id)) &&
          entry.status !== "delivered"
        ) {
          entry.status = "blocked";
          entry.reason =
            "Delivery was cancelled with its originating conversation branch.";
        }
      return ids;
    });
    const active = this.activeRunId();
    if (active && cancelled.has(active)) this.host.cancelInvocation?.(active);
  }
  async pauseRun(id: string, paused: boolean): Promise<void> {
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      if (!run) throw new Error("Execution run not found.");
      run.pauseRequested = paused;
      run.updatedAt = this.host.now();
    });
  }
  async acknowledgeCheckpoint(
    id: string,
    checkpointId: string,
    checkedIds: string[],
    note = "",
  ): Promise<void> {
    await this.store.mutate((next) => {
      const run = next.runs.find((item) => item.id === id);
      const checkpoint = run?.checkpoints?.find(
        (item) => item.id === checkpointId,
      );
      if (
        !run ||
        !checkpoint ||
        run.state !== "waiting-human" ||
        run.activeCheckpointId !== checkpointId ||
        checkpoint.beforeCursor !== run.cursor
      )
        throw new Error(
          "The manual checkpoint changed; refresh before acknowledging it.",
        );
      if (
        new Set(checkedIds).size !== checkedIds.length ||
        checkedIds.some(
          (field) => !checkpoint.items.some((item) => item.id === field),
        ) ||
        checkpoint.items.some(
          (item) => item.required && !checkedIds.includes(item.id),
        )
      )
        throw new Error(
          "Complete the required checklist items before continuing.",
        );
      run.checkpointEvidence = [
        ...(run.checkpointEvidence ?? []),
        {
          id: checkpointId,
          checkedIds: [...checkedIds],
          note: note.slice(0, 3000),
          completedAt: this.host.now(),
        },
      ];
      delete run.activeCheckpointId;
      run.state =
        run.cursor === run.invocations.length && !nextExecutionBoundary(run)
          ? "completed"
          : "queued";
      run.updatedAt = this.host.now();
    });
  }
}
