import type { ExecutionJournal, ExecutionRun } from "./execution-types";

export function cancelledExecutionLineage(
  journal: ExecutionJournal,
  run: Pick<ExecutionRun, "id" | "subject">,
): boolean {
  let current = run;
  const seen = new Set<string>();
  while (!seen.has(current.id)) {
    seen.add(current.id);
    if (
      journal.messaging?.roots.some(
        (root) => root.id === current.id && root.stopped,
      )
    )
      return true;
    if (
      journal.cancelledRunIds?.includes(current.id) ||
      journal.runs.some(
        (item) => item.id === current.id && item.state === "cancelled",
      )
    )
      return true;
    const message = journal.messaging?.outbox.find(
      (entry) => entry.message.id === current.subject.sourceId,
    )?.message;
    if (!message) return false;
    if (
      journal.cancelledRunIds?.includes(message.runId) ||
      journal.messaging?.roots.some(
        (root) => root.id === message.rootId && root.stopped,
      )
    )
      return true;
    const parent = journal.runs.find((item) => item.id === message.runId);
    if (!parent) return false;
    current = parent;
  }
  return true;
}
/** Includes settled descendants when finding future branches, but never rewrites their completed evidence. */
export function executionDescendants(
  journal: ExecutionJournal,
  runId: string,
): Set<string> {
  const ids = new Set([runId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const run of journal.runs) {
      const origin = journal.messaging?.outbox.find(
        (entry) => entry.message.id === run.subject.sourceId,
      )?.message.runId;
      if (origin && ids.has(origin) && !ids.has(run.id)) {
        ids.add(run.id);
        changed = true;
      }
    }
  }
  return ids;
}
