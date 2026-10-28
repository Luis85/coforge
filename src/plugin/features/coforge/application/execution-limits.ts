import { ExecutionBlockError } from "../domain/execution-block";
import type {
  ExecutionInvocation,
  ExecutionJournal,
  ExecutionRun,
} from "../domain/execution-run";
import { ExecutionMessageRejection } from "../domain/execution-message-rejection";
import { effectiveExecutionAllowance } from "../domain/execution-allowance";
import { timingReservations } from "./execution-timing-reservations";

export function reservedExecutionInvocations(run: ExecutionRun): number {
  const attempts = run.attempts.filter((attempt) => !attempt.skipped);
  return (
    run.invocations.length +
    attempts.length -
    new Set(attempts.map((attempt) => attempt.invocationId)).size
  );
}
/** First outgoing response creates the root with all earlier retry reservations included. */
export function accountInitialRootRetries(
  previous: ExecutionJournal,
  next: ExecutionJournal,
  run: ExecutionRun,
): void {
  const parent = next.messaging?.outbox.find(
    (entry) => entry.message.id === run.subject.sourceId,
  )?.message;
  const root = next.messaging?.roots.find(
    (item) => item.id === (parent?.rootId ?? run.id),
  );
  if (!root) return;
  if (!previous.messaging?.roots.some((item) => item.id === root.id)) {
    root.usage.invocations +=
      reservedExecutionInvocations(run) - run.invocations.length;
    root.usedExecutionMs = run.timing?.usedMs ?? 0;
    root.limitExecutionMs = effectiveExecutionAllowance(run).executionLimitMs;
  }
  if (root.usage.invocations > root.limits.invocations)
    throw new ExecutionMessageRejection("budget");
  const earlier = new Set(
    previous.messaging?.outbox.map((entry) => entry.message.id) ?? [],
  );
  if (
    (root.usedExecutionMs ?? 0) -
      timingReservations(run).reduce((sum, item) => sum + item.reservedMs, 0) >=
      (root.limitExecutionMs ?? 900000) &&
    next.messaging?.outbox.some(
      (entry) =>
        entry.message.rootId === root.id &&
        entry.message.startsRun &&
        !earlier.has(entry.message.id),
    )
  )
    throw new ExecutionMessageRejection("budget");
}

/** Initial expansions are reserved on admission/delivery; each retry consumes an additional root invocation. */
export function reserveExecutionDispatch(
  journal: ExecutionJournal,
  run: ExecutionRun,
  invocation: ExecutionInvocation,
): void {
  const attempts = run.attempts.filter((attempt) => !attempt.skipped);
  const retries =
    attempts.length -
    new Set(attempts.map((attempt) => attempt.invocationId)).size;
  const retry = attempts.some(
    (attempt) => attempt.invocationId === invocation.id,
  );
  if (
    run.invocations.length + retries + (retry ? 1 : 0) >
    effectiveExecutionAllowance(run).maxInvocations
  )
    throw new ExecutionBlockError("invocation-limit");
  const parent = journal.messaging?.outbox.find(
    (entry) => entry.message.id === run.subject.sourceId,
  )?.message;
  const root = journal.messaging?.roots.find(
    (item) => item.id === (parent?.rootId ?? run.id),
  );
  if (!root) return;
  if (root.stopped) throw new ExecutionBlockError("root-stopped");
  if (retry) {
    if (root.usage.invocations + 1 > root.limits.invocations)
      throw new ExecutionBlockError("invocation-limit");
    root.usage.invocations++;
  }
}
