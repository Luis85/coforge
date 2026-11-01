import type { AppState } from '../../features/coforge/domain/types';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { sameDurableBuildRef } from '../../features/coforge/domain/durable-build';
import type { AgentSessionFollowSnapshot } from './agent-session-terminal';

/** Resolve an opaque job ID within the active project; observations never grant provider access. */
export function agentSessionFollowView(state: AppState, jobId: string): AgentSessionFollowSnapshot | undefined {
  const job = state.jobs.find(candidate => candidate.id === jobId);
  const idea = job && state.ideas.find(candidate => candidate.id === job.ideaId);
  if (!job || !idea || !['claude', 'codex'].includes(job.provider) || !state.activeProjectId ||
      (job.projectId ?? ideaProjectId(idea)) !== state.activeProjectId || ideaProjectId(idea) !== state.activeProjectId) return undefined;
  const hot = state.runtime.durableBuildSnapshots?.[job.id];
  const trace = hot && job.durable && sameDurableBuildRef(hot.ref, job.durable.ref) && hot.sequence >= (job.durable.snapshot?.sequence ?? 0)
    ? hot.sessionTrace ?? job.sessionTrace : job.sessionTrace;
  if (!trace?.events.length) return undefined;
  return { label: job.workflow?.step.name ?? job.stage, status: job.status, trace };
}
