import { executionBlockReason } from "../domain/execution-block";
import type { ExecutionRun } from "../domain/execution-run";
import type { ExecutionLocalAction } from "../domain/execution-local-action";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import { nextExecutionBoundary } from "./execution-boundaries";
import { accountInitialRootRetries } from "./execution-limits";
import type { ExecutionTiming } from "./execution-timing";

export class ExecutionLocalActions {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly isPaused: () => boolean,
    private readonly timing: ExecutionTiming,
  ) {}
  async run(run: ExecutionRun, action: ExecutionLocalAction): Promise<void> {
    try {
      return await this.timing.measure(run.id, undefined, () =>
        this.commitAction(run, action),
      );
    } catch (error) {
      if (!this.store.isFaulted && this.store.find(run.id).state === "queued")
        await this.store.mutate((next) => {
          const current = next.runs.find((item) => item.id === run.id)!;
          current.state = "attention";
          current.reason = executionBlockReason(
            error,
            "The local action is blocked. Review execution allowance and live permissions before retrying.",
          );
        });
      throw error;
    }
  }
  private async commitAction(
    run: ExecutionRun,
    action: ExecutionLocalAction,
  ): Promise<void> {
    try {
      if (!this.host.assertLocalEligible || !this.host.commitLocalAction)
        throw new Error(
          "This host cannot enforce workflow message permissions.",
        );
      await this.host.assertLocalEligible(
        structuredClone(run),
        structuredClone(action),
      );
      if (this.isPaused()) throw new Error("Execution is paused.");
      await this.store.mutate((next) => {
        const current = next.runs.find((item) => item.id === run.id)!;
        if (current.localActionEvidence?.some((item) => item.id === action.id))
          return;
        if (current.state !== "queued" || current.cursor !== run.cursor)
          throw new Error("The local execution boundary changed.");
        const beforeMessages = structuredClone(next);
        const messageIds = this.host.commitLocalAction!(
          next,
          current,
          structuredClone(action),
        );
        accountInitialRootRetries(beforeMessages, next, current);
        current.localActionEvidence = [
          ...(current.localActionEvidence ?? []),
          { id: action.id, completedAt: this.host.now(), messageIds },
        ];
        current.state =
          current.cursor === current.invocations.length &&
          !nextExecutionBoundary(current)
            ? "completed"
            : "queued";
        current.updatedAt = this.host.now();
      });
    } catch (error) {
      if (!this.store.isFaulted)
        await this.store.mutate((next) => {
          const current = next.runs.find((item) => item.id === run.id)!;
          if (current.state === "queued") {
            current.state = "attention";
            current.reason = executionBlockReason(
              error,
              "The workflow message is blocked. Inspect recipient permissions, complete input bindings and inherited root limits before retrying.",
            );
          }
        });
      throw error;
    }
  }
}
