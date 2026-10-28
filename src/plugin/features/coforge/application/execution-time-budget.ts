import type {
  ExecutionInvocation,
  ExecutionJournal,
  ExecutionRun,
} from "../domain/execution-run";
import { effectiveExecutionAllowance } from "../domain/execution-allowance";
import { timingReservation } from "./execution-timing-reservations";
const rootFor = (journal: ExecutionJournal, run: ExecutionRun) => {
  const parent = journal.messaging?.outbox.find(
    (entry) => entry.message.id === run.subject.sourceId,
  )?.message;
  return journal.messaging?.roots.find(
    (root) => root.id === (parent?.rootId ?? run.id),
  );
};
export function remainingExecutionMs(
  journal: ExecutionJournal,
  run: ExecutionRun,
  invocation?: ExecutionInvocation,
  token?: string,
): number {
  const active = token ? timingReservation(run, token) : run.timing?.active;
  const allowance = effectiveExecutionAllowance(run);
  const reservation = active?.reservedMs ?? 0;
  const remaining = [
    allowance.executionLimitMs - (run.timing?.usedMs ?? 0) + reservation,
  ];
  const scope = invocation?.executionScope;
  if (scope)
    remaining.push(
      (allowance.scopeLimits.find((item) => item.id === scope.id)?.limitMs ??
        scope.limitMs) -
        (run.timing?.scopes.find((item) => item.id === scope.id)?.usedMs ?? 0) +
        (active?.scopeId === scope.id ? reservation : 0),
    );
  const root = rootFor(journal, run);
  if (root)
    remaining.push(
      (root.limitExecutionMs ?? 900000) -
        (root.usedExecutionMs ?? 0) +
        reservation,
    );
  return Math.max(0, Math.floor(Math.min(...remaining)));
}
export function chargeExecutionMs(
  journal: ExecutionJournal,
  run: ExecutionRun,
  scopeId: string | undefined,
  delta: number,
): void {
  run.timing ??= { usedMs: 0, scopes: [] };
  run.timing.usedMs = Math.max(0, run.timing.usedMs + delta);
  if (scopeId) {
    let scope = run.timing.scopes.find((item) => item.id === scopeId);
    if (!scope) {
      scope = { id: scopeId, usedMs: 0 };
      run.timing.scopes.push(scope);
    }
    scope.usedMs = Math.max(0, scope.usedMs + delta);
  }
  const root = rootFor(journal, run);
  if (root)
    root.usedExecutionMs = Math.max(0, (root.usedExecutionMs ?? 0) + delta);
}
