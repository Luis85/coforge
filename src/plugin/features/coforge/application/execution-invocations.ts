import {
  executionBlockReason,
  ExecutionBlockError,
} from "../domain/execution-block";
import {
  executionResponseCheck,
  EXECUTION_RESULT_RESERVE_BYTES,
  EXECUTION_RUN_BYTES,
  EXECUTION_JOURNAL_BYTES,
  type ExecutionArtifact,
  type ExecutionAttempt,
  type ExecutionDispatch,
  type ExecutionResponse,
} from "../domain/execution-run";
import { workflowSerializedSize } from "../domain/configured-workflow-run";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import type { ExecutionPublication } from "./execution-publication";
import type { ExecutionLocalActions } from "./execution-local-actions";
import { nextExecutionBoundary } from "./execution-boundaries";
import {
  accountInitialRootRetries,
  reserveExecutionDispatch,
} from "./execution-limits";
import { cancelledExecutionLineage } from "../domain/execution-lineage";
import {
  ExecutionMessageRejection,
  messageRejectionInfo,
} from "../domain/execution-message-rejection";
import { assertExecutionArtifactLimit } from "../domain/execution-artifact-limit";
import type { ExecutionTiming } from "./execution-timing";

export class ExecutionInvocations {
  private invoking = false;
  private activeRunId?: string;
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly publication: ExecutionPublication,
    private readonly localActions: ExecutionLocalActions,
    private readonly isPaused: () => boolean,
    private readonly timing: ExecutionTiming,
  ) {}
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
      let result: ExecutionResponse;
      const providerTiming = this.timing.hooks(id, invocation);
      try {
        try {
          result = executionResponseCheck(
            await this.host.invoke(
              structuredClone(this.store.find(id)),
              structuredClone(invocation),
              structuredClone(attempt),
              providerTiming,
            ),
          );
        } finally {
          await providerTiming.stop();
        }
        assertExecutionArtifactLimit(invocation, result);
        if (Boolean(result.plan) !== (invocation.output === "plan"))
          throw new Error(
            "The provider result does not match its declared Markdown or validated-plan contract.",
          );
      } catch (error) {
        await this.store.mutate((next) => {
          const current = next.runs.find((item) => item.id === id)!;
          const saved = current.attempts.find(
            (item) => item.id === attempt.id,
          )!;
          saved.status = "unknown";
          saved.error =
            "The provider did not yield a durably validated result. Inspect its original session before retrying.";
          if (current.state !== "cancelled") current.state = "attention";
          current.reason = saved.error;
        });
        throw error;
      }
      await this.store.mutate((next) => {
        const current = next.runs.find((item) => item.id === id)!;
        const saved = current.attempts.find((item) => item.id === attempt.id)!;
        const artifact: ExecutionArtifact = {
          ...result,
          id: `artifact-${attempt.id}`,
          runId: id,
          invocationId: invocation.id,
          attemptId: attempt.id,
          roundId: invocation.roundId,
          agentId: invocation.agentId,
          agentRevision: invocation.agentRevision,
          provider: invocation.provider,
          model: invocation.model,
          inputArtifactIds: [...dispatch.inputArtifactIds],
          createdAt: this.host.now(),
        };
        if (result.usage) {
          saved.usage = result.usage;
          saved.usageSource = "provider";
        }
        if (result.costUsd !== undefined) saved.costUsd = result.costUsd;
        if (!artifact.usage && saved.usage)
          artifact.usage = structuredClone(saved.usage);
        if (artifact.costUsd === undefined && saved.costUsd !== undefined)
          artifact.costUsd = saved.costUsd;
        if (result.messageDrafts?.length) {
          if (cancelledExecutionLineage(next, current)) {
            artifact.messagesRejected = true;
            artifact.messageRejection = messageRejectionInfo(
              new ExecutionMessageRejection("cancelled"),
            );
          } else if (!this.host.commitMessages) {
            artifact.messagesRejected = true;
            artifact.messageRejection = messageRejectionInfo(
              new ExecutionMessageRejection("unavailable"),
            );
          } else {
            // Work on a separate candidate so a rejected batch cannot leave a partial outbox or budget reservation.
            const messageCandidate = structuredClone(next);
            try {
              this.host.commitMessages(
                messageCandidate,
                structuredClone(current),
                structuredClone(saved),
                result.messageDrafts,
              );
              accountInitialRootRetries(next, messageCandidate, current);
              next.messaging = messageCandidate.messaging;
            } catch (error) {
              artifact.messagesRejected = true;
              artifact.messageRejection = messageRejectionInfo(error);
            }
          }
        }
        current.artifacts.push(artifact);
        saved.artifactId = artifact.id;
        saved.status = "responded";
        if (current.state !== "cancelled") current.state = "publishing";
        current.updatedAt = this.host.now();
      });
      await this.publication.repair(id);
    } finally {
      this.invoking = false;
      delete this.activeRunId;
    }
  }
}
