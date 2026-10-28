import {
  executionBlockReason,
  ExecutionBlockError,
} from "../domain/execution-block";
import {
  EXECUTION_RESULT_RESERVE_BYTES,
  EXECUTION_RUN_BYTES,
  EXECUTION_JOURNAL_BYTES,
  type ExecutionAttempt,
  type ExecutionDispatch,
} from "../domain/execution-run";
import { workflowSerializedSize } from "../domain/configured-workflow-run";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import type { ExecutionPublication } from "./execution-publication";
import type { ExecutionLocalActions } from "./execution-local-actions";
import { nextExecutionBoundary } from "./execution-boundaries";
import { reserveExecutionDispatch } from "./execution-limits";
import type { ExecutionTiming } from "./execution-timing";

import { ExecutionAttemptWork } from "./execution-attempt-work";
import { ExecutionFanout } from "./execution-fanout";

export class ExecutionInvocations {
  private readonly attemptWork: ExecutionAttemptWork;
  private readonly fanout: ExecutionFanout;
  private invoking = false;
  private activeRunId?: string;
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly publication: ExecutionPublication,
    private readonly localActions: ExecutionLocalActions,
    private readonly isPaused: () => boolean,
    private readonly timing: ExecutionTiming,
  ) {
    this.attemptWork = new ExecutionAttemptWork(store, host, timing);
    this.fanout = new ExecutionFanout(
      store,
      host,
      publication,
      timing,
      this.attemptWork,
      isPaused,
    );
  }
  get isInvoking(): boolean {
    return this.invoking;
  }
  get activeId(): string | undefined {
    return this.activeRunId;
  }
  cancelActive(): void {
    if (this.activeRunId) this.host.cancelInvocation?.(this.activeRunId);
  }
  async step(id: string): Promise<void> {
    this.store.assertLoaded();
    if (this.isPaused())
      throw new Error(
        "Execution is paused. Resume explicitly before dispatch.",
      );
    if (this.invoking)
      throw new Error("Another provider invocation is already active.");
    const run = this.store.find(id);
    if (run.pauseRequested)
      throw new Error("This execution is paused by the operator.");
    if (run.state !== "queued")
      throw new Error(
        `This run requires ${run.state === "publishing" ? "publication repair" : run.state} before another invocation.`,
      );
    const boundary = nextExecutionBoundary(run);
    if (boundary?.kind === "checkpoint") {
      await this.store.mutate((next) => {
        const current = next.runs.find((item) => item.id === id)!;
        current.state = "waiting-human";
        current.activeCheckpointId = boundary.checkpoint.id;
        current.updatedAt = this.host.now();
      });
      return;
    }
    if (boundary?.kind === "message") {
      await this.localActions.run(run, boundary.action);
      return;
    }
    const invocation = run.invocations[run.cursor];
    if (!invocation) throw new Error("This run has no pending invocation.");
    this.invoking = true;
    this.activeRunId = id;
    try {
      if (invocation.promptOrder === "fan-out") {
        await this.fanout.step(structuredClone(run));
        return;
      }
      let dispatch: ExecutionDispatch;
      try {
        dispatch = await this.timing.measure(id, invocation, async () => {
          await this.host.assertEligible(
            structuredClone(run),
            structuredClone(invocation),
          );
          return this.host.resolveInvocation(
            structuredClone(run),
            structuredClone(invocation),
          );
        });
      } catch (error) {
        await this.store.mutate((next) => {
          const current = next.runs.find((item) => item.id === id)!;
          if (current.state === "queued") {
            current.state = "attention";
            current.reason = executionBlockReason(
              error,
              "Dispatch preflight is blocked. Refresh definitions, source and provider permissions before retrying.",
            );
            current.updatedAt = this.host.now();
          }
        });
        throw error;
      }
      if (this.isPaused()) throw new Error("Execution is paused.");
      const attempt: ExecutionAttempt = {
        id: this.host.id(),
        invocationId: invocation.id,
        status: "dispatching",
        startedAt: this.host.now(),
        dispatch,
      };
      try {
        await this.store.mutate((next) => {
          const current = next.runs.find((item) => item.id === id)!;
          if (current.state !== "queued" || current.cursor !== run.cursor)
            throw new Error("The execution action changed before dispatch.");
          if (current.attempts.length >= 200)
            throw new Error("The execution attempt limit was reached.");
          reserveExecutionDispatch(next, current, invocation);
          current.attempts.push(attempt);
          current.state = "running";
          current.updatedAt = this.host.now();
          if (
            workflowSerializedSize(current) >
            EXECUTION_RUN_BYTES - EXECUTION_RESULT_RESERVE_BYTES
          )
            throw new ExecutionBlockError("storage");
          if (
            workflowSerializedSize(next) >
            EXECUTION_JOURNAL_BYTES - EXECUTION_RESULT_RESERVE_BYTES
          )
            throw new ExecutionBlockError("storage");
        });
      } catch (error) {
        if (!this.store.isFaulted)
          await this.store.mutate((next) => {
            const current = next.runs.find((item) => item.id === id)!;
            if (current.state === "queued") {
              current.state = "attention";
              current.reason = executionBlockReason(
                error,
                "Dispatch could not reserve durable evidence. Inspect queue capacity and storage before retrying.",
              );
            }
          });
        throw error;
      }
      await this.attemptWork.run(id, invocation, attempt);
      await this.publication.repair(id);
    } finally {
      this.invoking = false;
      delete this.activeRunId;
    }
  }
}
