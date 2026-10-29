export interface CouncilMonitorFilters {
  projectFilter: string;
  sourceFilter: string;
  stateFilter: string;
  teamFilter: string;
  targetFilter: string;
}
export function councilRunState(run: {
  state: string;
  hasGaps?: boolean;
}): string {
  if (!run.hasGaps) return run.state;
  return run.state === "completed"
    ? "Completed with gaps"
    : `${run.state} · missing contributions`;
}
export function legacyRunMatches(
  run: { projectId: string; sourceId: string; state: string },
  filters: CouncilMonitorFilters,
): boolean {
  return (
    !filters.teamFilter &&
    !filters.targetFilter &&
    (!filters.projectFilter || run.projectId === filters.projectFilter) &&
    (!filters.sourceFilter ||
      run.sourceId
        .toLowerCase()
        .includes(filters.sourceFilter.toLowerCase())) &&
    (!filters.stateFilter || run.state === filters.stateFilter)
  );
}
/** Announce action-boundary facts only; artifact bodies and telemetry never enter the status region. */
export function councilProgressAnnouncement(run: {
  state: string;
  hasGaps?: boolean;
  cursor: number;
  invocations: readonly { roundId: string; agentId: string }[];
}): string {
  const next = run.invocations[run.cursor];
  return `${councilRunState(run)}. ${run.cursor} of ${run.invocations.length} steps completed or skipped.${next ? ` Current action: ${next.roundId}, ${next.agentId}.` : ""}`;
}
