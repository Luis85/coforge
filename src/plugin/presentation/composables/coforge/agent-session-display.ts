import type { AgentJob, AppState, Idea } from '../../../features/coforge/domain/types';
import type { AgentSessionEntry, AgentSessionTrace } from '../../../features/coforge/domain/agent-session';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { sameDurableBuildRef } from '../../../features/coforge/domain/durable-build';
import { STAGE_LABELS } from '../../../features/coforge/domain/types';
import { formatTime } from './format';

export const nativeSessionProvider = (job: AgentJob) => ['claude', 'codex'].includes(job.provider) && job.conversation?.simulated !== true;
export function ideaSessionJobs(state: AppState | null, idea: Idea): AgentJob[] {
  const projectId = ideaProjectId(idea);
  if (!state || state.activeProjectId !== projectId) return [];
  return state.jobs.filter(job => job.ideaId === idea.id && (!job.projectId || job.projectId === projectId)).slice().reverse()
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}
export function sessionObservation(state: AppState | null, job: AgentJob) {
  const hot = state?.runtime.durableBuildSnapshots?.[job.id];
  const matching = job.durable && hot && sameDurableBuildRef(job.durable.ref, hot.ref) && hot.sequence >= (job.durable.snapshot?.sequence ?? 0) ? hot : undefined;
  return {
    trace: nativeSessionProvider(job) ? matching?.sessionTrace ?? job.sessionTrace : undefined,
    verification: matching?.verification ?? matching?.result?.verification ?? job.verification ?? [],
  };
}
export const sessionTitle = (job: AgentJob) => job.workflow?.step.name ?? STAGE_LABELS[job.stage];
export const sessionProviderLabel = (job: AgentJob) => ({ claude: 'Claude Code', codex: 'Codex', demo: 'Simulation', mcp: 'External MCP client', herdr: 'Herdr' })[job.provider];
export function sessionCaptureHint(job: AgentJob, trace?: AgentSessionTrace): string {
  if (job.provider === 'demo' || job.conversation?.simulated) return 'Simulation · No native provider session or live capture.';
  if (job.provider === 'mcp' || job.provider === 'herdr') return 'External execution · Detailed session visibility is unavailable here.';
  if (!trace && ['failed', 'cancelled'].includes(job.status)) return 'No detailed session capture was recorded. The failure panel identifies the evidence retained for this attempt.';
  return trace ? 'Observed public messages, tool names and session status. This is a bounded capture, not the complete provider conversation.' : ['queued', 'running'].includes(job.status) ? 'No observations captured yet. Detailed provider output is not available for this attempt.' : 'No detailed session capture was recorded for this attempt. Activity retains any captured task and final response.';
}
export interface ObservedSessionChild { id: string; parentId: string; label: string; status: string }
export function observedSessionChildren(trace?: AgentSessionTrace): ObservedSessionChild[] {
  const children = new Map<string, ObservedSessionChild>();
  for (const event of trace?.events ?? []) if (event.kind === 'session' && event.sessionId && event.parentSessionId && event.sessionId !== event.parentSessionId) {
    const previous = children.get(event.sessionId);
    children.set(event.sessionId, { id: event.sessionId, parentId: event.parentSessionId, label: event.label ?? previous?.label ?? 'Observed native assistant', status: event.status ?? previous?.status ?? 'unknown' });
  }
  return [...children.values()];
}
export function sessionEventView(event: AgentSessionEntry, children: ObservedSessionChild[]) {
  const child = children.find(child => child.id === event.sessionId);
  return { ...event, actor: child?.label ?? (event.parentSessionId ? 'Observed native session' : 'Parent capture'),
    heading: event.kind === 'tool' ? `Tool · ${event.tool ?? 'Name unavailable'}` : event.kind === 'session' ? event.label ?? 'Session status' : event.kind === 'notice' ? 'Observation' : 'Assistant message',
    timeLabel: formatTime(event.observedAt),
  };
}
export type SessionEventView = ReturnType<typeof sessionEventView>;
export function sessionElapsed(job: AgentJob, now: number): string {
  const end = ['queued', 'running'].includes(job.status) ? now : Date.parse(job.finishedAt ?? job.sessionTrace?.lastObservedAt ?? job.startedAt);
  const seconds = Math.max(0, Math.floor((end - Date.parse(job.startedAt)) / 1000));
  if (!Number.isFinite(seconds)) return 'Unavailable';
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
}
