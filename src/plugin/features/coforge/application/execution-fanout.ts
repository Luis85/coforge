import type {
  ExecutionAttempt,
  ExecutionInvocation,
  ExecutionRun,
} from "../domain/execution-run";
import {
  EXECUTION_JOURNAL_BYTES,
  EXECUTION_RUN_BYTES,
  EXECUTION_RESULT_RESERVE_BYTES,
} from "../domain/execution-run";
import { workflowSerializedSize } from "../domain/configured-workflow-run";
import {
  ExecutionBlockError,
  executionBlockReason,
} from "../domain/execution-block";
import type { ExecutionJournalStore } from "./execution-journal-store";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionTiming } from "./execution-timing";
import type { ExecutionAttemptWork } from "./execution-attempt-work";
import type { ExecutionPublication } from "./execution-publication";
import { reserveExecutionDispatch } from "./execution-limits";
import { nextExecutionBoundary } from "./execution-boundaries";

/** One frozen round batch, independent attempt commits, then deterministic publication barriers. */
export class ExecutionFanout {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly publication: ExecutionPublication,
    private readonly timing: ExecutionTiming,
    private readonly work: ExecutionAttemptWork,
    private readonly paused: () => boolean,
  ) {}
  async step(snapshot: ExecutionRun): Promise<void> {
    const first = snapshot.invocations[snapshot.cursor]!;
    const round: ExecutionInvocation[] = [];
    for (
      let index = snapshot.cursor;
      index < snapshot.invocations.length;
      index++
    ) {
      const invocation = snapshot.invocations[index]!;
      if (
        invocation.roundId !== first.roundId ||
        invocation.promptOrder !== "fan-out"
      )
        break;
      // Composed workflows may insert a human/local boundary even inside the same logical round.
      if (
        index > snapshot.cursor &&
        nextExecutionBoundary({ ...snapshot, cursor: index })
      )
        break;
      round.push(invocation);
    }
    const pending = round.filter(
      (invocation) =>
        !snapshot.artifacts.some(
          (artifact) => artifact.invocationId === invocation.id,
        ),
    );
    if (!pending.length) {
      await this.publication.repair(snapshot.id);
      return;
    }
    const prepared: {
      invocation: ExecutionInvocation;
      attempt: ExecutionAttempt;
    }[] = [];
    let contacted = false;
    try {
      for (const invocation of pending) {
        const dispatch = await this.timing.measure(
          snapshot.id,
          invocation,
          async () => {
            await this.host.assertEligible(
              structuredClone(snapshot),
              structuredClone(invocation),
            );
            return this.host.resolveInvocation(
              structuredClone(snapshot),
              structuredClone(invocation),
            );
          },
        );
        prepared.push({
          invocation,
          attempt: {
            id: this.host.id(),
            invocationId: invocation.id,
            status: "dispatching",
            startedAt: this.host.now(),
            dispatch,
          },
        });
      }
      this.assertReady(snapshot.id);
      await this.store.mutate((next) => {
        const run = next.runs.find((item) => item.id === snapshot.id)!;
        if (run.state !== "queued" || run.cursor !== snapshot.cursor)
          throw new Error("The round changed before dispatch.");
        if (
          run.attempts.some(
            (attempt) =>
              attempt.status === "unknown" &&
              !attempt.uncertaintyAcknowledgedAt,
          )
        )
          throw new Error(
            "Acknowledge every unknown round outcome before retrying.",
          );
        if (run.attempts.length + prepared.length > 200)
          throw new Error("The execution attempt limit was reached.");
        for (const item of prepared) {
          reserveExecutionDispatch(next, run, item.invocation);
          run.attempts.push(item.attempt);
        }
        // Bounded responses plus shared message/projection overhead are reserved before ANY provider call.
        const reserve =
          EXECUTION_RESULT_RESERVE_BYTES + prepared.length * 64000;
        if (
          workflowSerializedSize(run) > EXECUTION_RUN_BYTES - reserve ||
          workflowSerializedSize(next) > EXECUTION_JOURNAL_BYTES - reserve
        )
          throw new ExecutionBlockError("storage");
        run.state = "running";
        run.updatedAt = this.host.now();
      });
      const invoke = async () => {
        const hooks = prepared.map((item) =>
          this.timing.hooks(snapshot.id, item.invocation),
        );
        try {
          this.assertReady(snapshot.id);
          // A partial timing reservation cannot launch a partial round: prepare all hooks first.
          for (const hook of hooks) await hook.start();
          this.assertReady(snapshot.id);
          if (hooks.some((hook) => hook.remainingMs <= 0))
            throw new ExecutionBlockError("execution-time");
          contacted = true;
          const results = await Promise.allSettled(
            prepared.map((item, index) =>
              this.work.run(
                snapshot.id,
                item.invocation,
                item.attempt,
                hooks[index],
                snapshot,
              ),
            ),
          );
          const failed = results.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
        } finally {
          await Promise.all(hooks.map((hook) => hook.stop()));
        }
      };
      if (this.host.withInvocationBatch)
        await this.host.withInvocationBatch(snapshot, invoke);
      else await invoke();
    } catch (error) {
      if (!this.store.isFaulted)
        await this.store.mutate((next) => {
          const run = next.runs.find((item) => item.id === snapshot.id)!;
          if (!contacted)
            for (const item of prepared) {
              const attempt = run.attempts.find(
                (candidate) => candidate.id === item.attempt.id,
              );
              if (attempt?.status === "dispatching") {
                attempt.status = "not-started";
                attempt.error =
                  "The round was blocked before any provider was contacted. Retry explicitly after resolving its gate or allowance.";
              }
            }
          if (run.state !== "cancelled") run.state = "attention";
          run.reason = contacted
            ? "A round member needs explicit recovery. Successful peer results were retained and will not be invoked again."
            : `No provider was contacted. ${executionBlockReason(error, "Review the round preflight, provider gate and finite allowance before retrying.")}`;
          run.updatedAt = this.host.now();
        });
      if (!this.store.isFaulted) await this.publishPrefix(snapshot.id);
      throw error;
    }
    await this.publishPrefix(snapshot.id);
  }
  private async publishPrefix(id: string) {
    const run = this.store.find(id);
    if (
      run.artifacts.some(
        (artifact) =>
          artifact.invocationId === run.invocations[run.cursor]?.id &&
          run.attempts.some(
            (attempt) =>
              attempt.artifactId === artifact.id &&
              attempt.status === "responded",
          ),
      )
    )
      await this.publication.repair(id);
  }
  private assertReady(id: string) {
    const run = this.store.find(id);
    if (this.paused() || run.pauseRequested || run.state === "cancelled")
      throw new Error(
        "The round was paused or cancelled before provider dispatch.",
      );
  }
}
