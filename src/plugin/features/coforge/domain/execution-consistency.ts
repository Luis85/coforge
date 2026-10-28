import type { ExecutionRun } from "./execution-types";
import { MESSAGE_REJECTION_REASONS } from "./execution-message-rejection";

/** Persisted progress and attribution must agree before the host can dispatch from a journal. */
export function assertExecutionRunConsistency(run: ExecutionRun): void {
  if (
    (run.timing?.active && run.timing.parallel?.length) ||
    new Set(run.timing?.parallel?.map((item) => item.token)).size !==
      (run.timing?.parallel?.length ?? 0)
  )
    throw new Error(
      "Execution timing reservations have inconsistent identities.",
    );
  if (
    run.attempts.some(
      (attempt) =>
        attempt.status === "not-started" &&
        (attempt.artifactId || attempt.usage || attempt.costUsd !== undefined),
    )
  )
    throw new Error(
      "An undispatched attempt cannot carry provider result or telemetry evidence.",
    );
  if (
    run.invocations.some(
      (invocation) =>
        invocation.promptOrder === "fan-out" &&
        run.invocations.some(
          (other) =>
            other.roundId === invocation.roundId &&
            other.promptOrder !== "fan-out",
        ),
    )
  )
    throw new Error(
      "Every captured member of a fan-out round must agree on prompt order.",
    );
  if (
    run.artifacts.some(
      (artifact) =>
        artifact.messageRejection &&
        (!artifact.messagesRejected ||
          artifact.messageRejection.reason !==
            MESSAGE_REJECTION_REASONS[artifact.messageRejection.code]),
    )
  )
    throw new Error(
      "Outgoing-message rejection evidence must use a trusted fixed policy reason.",
    );
  if (
    run.artifacts.some(
      (artifact) =>
        !artifact.skipped &&
        artifact.markdown.length >
          (run.invocations.find((item) => item.id === artifact.invocationId)
            ?.maxArtifactCharacters ?? 16000),
    )
  )
    throw new Error(
      "A retained artifact exceeds its captured output allowance.",
    );
  const invocations = new Set(run.invocations.map((item) => item.id));
  const attempts = new Set(run.attempts.map((item) => item.id));
  if (
    !run.invocations.length &&
    !run.checkpoints?.length &&
    !run.localActions?.length
  )
    throw new Error("Execution requires an invocation or a local action.");
  if (
    new Set(run.localActions?.map((item) => item.id)).size !==
      (run.localActions?.length ?? 0) ||
    run.localActions?.some(
      (item) => item.beforeCursor > run.invocations.length,
    ) ||
    run.localActionEvidence?.some(
      (item) => !run.localActions?.some((action) => action.id === item.id),
    )
  )
    throw new Error("Local execution actions have inconsistent identities.");
  if (
    new Set(run.checkpoints?.map((item) => item.id)).size !==
      (run.checkpoints?.length ?? 0) ||
    run.checkpoints?.some(
      (item) =>
        item.beforeCursor > run.invocations.length ||
        new Set(item.items.map((field) => field.id)).size !== item.items.length,
    ) ||
    run.checkpointEvidence?.some(
      (item) =>
        !run.checkpoints?.some((checkpoint) => checkpoint.id === item.id),
    ) ||
    (run.activeCheckpointId &&
      !run.checkpoints?.some((item) => item.id === run.activeCheckpointId))
  )
    throw new Error("Execution checkpoint references are inconsistent.");
  if (
    run.projectionRecovery?.pendingArtifactIds.some(
      (artifactId) =>
        !run.artifacts.some((artifact) => artifact.id === artifactId),
    )
  )
    throw new Error(
      "Publication recovery references a missing saved artifact.",
    );
  if (
    invocations.size !== run.invocations.length ||
    attempts.size !== run.attempts.length ||
    run.cursor > run.invocations.length ||
    new Set(run.artifacts.map((item) => item.id)).size !==
      run.artifacts.length ||
    run.attempts.some((item) => !invocations.has(item.invocationId)) ||
    run.artifacts.some(
      (item) =>
        item.runId !== run.id ||
        !attempts.has(item.attemptId) ||
        !invocations.has(item.invocationId),
    ) ||
    run.attempts.some(
      (item) =>
        item.artifactId &&
        !run.artifacts.some(
          (artifact) =>
            artifact.id === item.artifactId && artifact.attemptId === item.id,
        ),
    )
  )
    throw new Error("Execution run has inconsistent evidence references.");
  if (
    new Set(run.artifacts.map((item) => item.invocationId)).size !==
      run.artifacts.length ||
    run.artifacts.some((artifact) => {
      const invocation = run.invocations.find(
        (item) => item.id === artifact.invocationId,
      );
      const attempt = run.attempts.find(
        (item) => item.id === artifact.attemptId,
      );
      return (
        !invocation ||
        !attempt ||
        attempt.invocationId !== invocation.id ||
        artifact.agentId !== invocation.agentId ||
        artifact.roundId !== invocation.roundId ||
        artifact.agentRevision !== invocation.agentRevision ||
        artifact.provider !== invocation.provider ||
        artifact.model !== invocation.model ||
        Boolean(artifact.plan) !==
          (invocation.output === "plan" && !artifact.skipped) ||
        (artifact.plan !== undefined &&
          artifact.markdown !== artifact.plan.markdown) ||
        Boolean(artifact.skipped) !== Boolean(artifact.skipReason) ||
        Boolean(artifact.skipped) !== Boolean(attempt.skipped)
      );
    })
  )
    throw new Error(
      "Execution artifacts have inconsistent participant attribution.",
    );
  const published = run.artifacts.filter((artifact) =>
    run.attempts.some(
      (attempt) =>
        attempt.artifactId === artifact.id && attempt.status === "published",
    ),
  );
  if (
    published.length !== run.cursor ||
    published.some(
      (artifact) =>
        run.invocations.findIndex(
          (item) => item.id === artifact.invocationId,
        ) >= run.cursor,
    )
  )
    throw new Error(
      "Execution cursor does not match published contribution evidence.",
    );
  if (
    run.state === "completed" &&
    (run.cursor !== run.invocations.length ||
      run.checkpoints?.some(
        (checkpoint) =>
          !run.checkpointEvidence?.some(
            (evidence) => evidence.id === checkpoint.id,
          ),
      ) ||
      run.localActions?.some(
        (action) =>
          !run.localActionEvidence?.some(
            (evidence) => evidence.id === action.id,
          ),
      ))
  )
    throw new Error(
      "A completed execution still contains an unfinished action.",
    );
}
