import type {
  ExecutionCheckpoint,
  ExecutionRun,
} from "../domain/execution-run";
import type { ExecutionLocalAction } from "../domain/execution-local-action";

export type ExecutionBoundary =
  | { kind: "checkpoint"; order: number; checkpoint: ExecutionCheckpoint }
  | { kind: "message"; order: number; action: ExecutionLocalAction };
/** Manual and deterministic actions keep their authored ordering even between the same two invocations. */
export function nextExecutionBoundary(
  run: ExecutionRun,
): ExecutionBoundary | undefined {
  const checkpoints: ExecutionBoundary[] = (run.checkpoints ?? [])
    .filter(
      (item) =>
        item.beforeCursor === run.cursor &&
        !run.checkpointEvidence?.some((evidence) => evidence.id === item.id),
    )
    .map((checkpoint, index) => ({
      kind: "checkpoint",
      order: checkpoint.order ?? index,
      checkpoint,
    }));
  const actions: ExecutionBoundary[] = (run.localActions ?? [])
    .filter(
      (item) =>
        item.beforeCursor === run.cursor &&
        !run.localActionEvidence?.some((evidence) => evidence.id === item.id),
    )
    .map((action) => ({ kind: "message", order: action.order, action }));
  return [...checkpoints, ...actions].sort(
    (left, right) => left.order - right.order,
  )[0];
}
