import {
  executionResponseCheck,
  type ExecutionArtifact,
  type ExecutionAttempt,
  type ExecutionInvocation,
  type ExecutionResponse,
  type ExecutionRun,
} from "../domain/execution-run";
import type { ExecutionKernelHost } from "./execution-ports";
import type { ExecutionJournalStore } from "./execution-journal-store";
import { accountInitialRootRetries } from "./execution-limits";
import { cancelledExecutionLineage } from "../domain/execution-lineage";
import {
  ExecutionMessageRejection,
  messageRejectionInfo,
} from "../domain/execution-message-rejection";
import { assertExecutionArtifactLimit } from "../domain/execution-artifact-limit";
import type { ExecutionTiming, ExecutionTimingHooks } from "./execution-timing";

/** One attempt/result path shared by sequential and concurrent round execution. */
export class ExecutionAttemptWork {
  constructor(
    private readonly store: ExecutionJournalStore,
    private readonly host: ExecutionKernelHost,
    private readonly timing: ExecutionTiming,
  ) {}
  async run(
    id: string,
    invocation: ExecutionInvocation,
    attempt: ExecutionAttempt,
    timing?: ExecutionTimingHooks,
    snapshot?: ExecutionRun,
  ): Promise<void> {
    let result: ExecutionResponse;
    const providerTiming = timing ?? this.timing.hooks(id, invocation);
    try {
      try {
        result = executionResponseCheck(
          await this.host.invoke(
            structuredClone(snapshot ?? this.store.find(id)),
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
      await this.markUnknown(id, attempt.id);
      throw error;
    }
    try {
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
          inputArtifactIds: [...attempt.dispatch.inputArtifactIds],
          createdAt: this.host.now(),
        };
        if (result.usage) {
          saved.usage = { ...saved.usage, ...result.usage };
          saved.usageSource = "provider";
        }
        if (result.costUsd !== undefined) saved.costUsd = result.costUsd;
        if (saved.usage) artifact.usage = structuredClone(saved.usage);
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
        current.artifacts.sort(
          (a, b) =>
            current.invocations.findIndex(
              (item) => item.id === a.invocationId,
            ) -
            current.invocations.findIndex((item) => item.id === b.invocationId),
        );
        saved.artifactId = artifact.id;
        saved.status = "responded";
        if (current.state !== "cancelled" && current.state !== "attention")
          current.state = "publishing";
        current.updatedAt = this.host.now();
      });
    } catch (error) {
      await this.markUnknown(id, attempt.id);
      throw error;
    }
  }
  private async markUnknown(id: string, attemptId: string) {
    if (this.store.isFaulted) return;
    await this.store.mutate((next) => {
      const current = next.runs.find((item) => item.id === id)!;
      const saved = current.attempts.find((item) => item.id === attemptId)!;
      if (saved.status === "responded" || saved.status === "published") return;
      saved.status = "unknown";
      saved.error =
        "The provider did not yield a durably validated result. Inspect its original session before retrying.";
      if (current.state !== "cancelled") current.state = "attention";
      current.reason = saved.error;
      current.updatedAt = this.host.now();
    });
  }
}
