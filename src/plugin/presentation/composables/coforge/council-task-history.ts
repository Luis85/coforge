import type { CouncilRuntimeSnapshot } from "../../../features/coforge/application/council-ports";
import type { CouncilTaskRecord } from "../../../features/coforge/application/council-tasks";
import type { ExecutionRun } from "../../../features/coforge/domain/execution-run";
import { councilRunState } from "./council-monitor-display";

export interface CouncilTaskHistoryRow {
  id: string;
  kind: "run" | "draft" | "observed";
  title: string;
  source: string;
  projectId: string;
  status: string;
  detail: string;
  at: string;
  runId?: string;
  task?: CouncilTaskRecord;
}
const capturedTitle = (markdown: string, fallback?: string) => {
  const body = markdown.replace(
    /^\uFEFF?---[\t ]*\r?\n[\s\S]*?\r?\n---[\t ]*(?:\r?\n|$)/u,
    "",
  );
  const lines = body.split(/\r?\n/u);
  const title =
    lines.find((line) => /^#{1,6}\s+\S/u.test(line)) ??
    lines.find(
      (line) => line.trim() && !/^\s*(?:---+|```.*|~~~.*)\s*$/u.test(line),
    );
  return (
    title?.replace(/^#{1,6}\s+/u, "").trim() ||
    fallback ||
    "Untitled task"
  ).slice(0, 160);
};

function runStatus(run: ExecutionRun, paused: boolean) {
  if (
    run.attempts.some(
      (attempt) =>
        attempt.status === "unknown" && !attempt.uncertaintyAcknowledgedAt,
    )
  )
    return "Outcome unknown · inspect recovery";
  if (run.pauseRequested || (paused && run.state === "queued"))
    return `${run.state} · execution paused`;
  return councilRunState(run);
}

/** Retained runs preserve every generation; observed inbox states never fabricate an admission. */
export function councilTaskHistory(
  snapshot: CouncilRuntimeSnapshot | null,
  tasks: readonly CouncilTaskRecord[],
): CouncilTaskHistoryRow[] {
  const runs = snapshot?.runs ?? [];
  const rows: CouncilTaskHistoryRow[] = runs.map((run) => {
    const task = tasks.find((item) => item.sourceId === run.subject.sourceId);
    const observed = snapshot?.intake.find(
      (item) => item.sourceId === run.subject.sourceId,
    );
    return {
      id: `run:${run.id}`,
      kind: "run",
      runId: run.id,
      title: capturedTitle(run.subject.markdown, task?.title),
      source: task?.path ?? observed?.path ?? run.subject.sourceId,
      projectId: run.projectId,
      status: `${run.limits?.simulation ? 'Simulation · ' : ''}${runStatus(run, snapshot?.paused ?? true)}`,
      detail: `${run.cursor}/${run.invocations.length} steps completed or skipped${run.reason ? ` · ${run.reason}` : ""}`,
      at: run.updatedAt,
    };
  });
  for (const task of tasks) {
    if (runs.some((run) => run.subject.sourceId === task.sourceId)) continue;
    rows.push({
      id: `draft:${task.sourceId}`,
      kind: "draft",
      task,
      title: task.title,
      source: task.path,
      projectId: task.projectId,
      status: "Saved note · no retained run",
      detail:
        "No retained run is available for this source. It may be unsubmitted or its readable history may have been cleared.",
      at: task.createdAt,
    });
  }
  for (const observed of snapshot?.intake ?? []) {
    if (
      rows.some((row) => row.source === observed.path) ||
      runs.some((run) => run.subject.sourceId === observed.sourceId)
    )
      continue;
    rows.push({
      id: `observed:${observed.path}`,
      kind: "observed",
      title: observed.path.split("/").at(-1) ?? observed.path,
      source: observed.path,
      projectId: "",
      status: `Inbox observation · ${observed.status}`,
      detail:
        observed.reason ??
        "Latest reconciliation state; this is not an admitted task record.",
      at: "",
    });
  }
  return rows.sort(
    (a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id),
  );
}
