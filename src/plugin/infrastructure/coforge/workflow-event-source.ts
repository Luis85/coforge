import type { StudioService } from '../../features/coforge/application/studio';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import type { StudioEvent } from '../../features/coforge/application/studio-events';
import type { AutomationContext } from '../../features/coforge/domain/automation-context';
import { contextEventId } from '../../features/coforge/domain/integrity';
import type { AppState } from '../../features/coforge/domain/types';
import { ideaProjectId } from '../../features/coforge/domain/projects';

/** Resolve only explicit entity identities. The selected board is never an event's parent. */
export function studioAutomationEvent(event: StudioEvent, state: AppState): AutomationContext {
  const entity = event.record.entityId;
  const job = state.jobs.find(job => job.id === entity);
  const idea = state.ideas.find(idea => idea.id === (job?.ideaId ?? entity));
  const project = state.projects?.find(project => project.id === entity);
  const run = state.ideas.flatMap(idea => [...(idea.workflowHistory ?? []), ...(idea.workflowRun ? [idea.workflowRun] : [])])
    .find(run => run.id === (job?.workflow?.runId ?? entity));
  const projectId = job?.projectId ?? run?.projectId ?? (idea ? ideaProjectId(idea) : project?.id);
  return { id: `event-${contextEventId(`${event.record.sequence}:${event.record.at}:${event.type}`)}`, type: event.type, at: event.record.at,
    ...(projectId ? { projectId } : {}), ...(idea ? { ideaId: idea.id } : run ? { ideaId: run.ideaId } : {}),
    ...(job ? { jobId: job.id } : {}), ...(run ? { runId: run.id } : {}), ...(run?.automationEvent?.origin ? { origin: run.automationEvent.origin } : {}) };
}
export function subscribeWorkflowEvents(studio: StudioService, council: CouncilActions, listener: (event: AutomationContext) => void): () => void {
  const states = new Map(council.snapshot().runs.map(run => [run.id, run.state]));
  const stopStudio = studio.onEvent(event => listener(studioAutomationEvent(event, studio.state())));
  const stopCouncil = council.subscribe(snapshot => {
    if (!snapshot.ready) return;
    for (const run of snapshot.runs) {
      const previous = states.get(run.id); states.set(run.id, run.state);
      const type = previous === undefined ? 'execution-admitted' : run.state === 'completed' ? 'execution-completed' : run.state === 'cancelled' ? 'execution-cancelled' : run.state === 'attention' ? 'execution-attention' : '';
      if (!type || previous === run.state) continue;
      listener({ id: `execution-${contextEventId(`${run.id}:${run.state}:${run.updatedAt}`)}`, type, at: run.updatedAt, projectId: run.projectId, runId: run.id,
        ...(run.subject.kind === 'idea' ? { ideaId: run.subject.ideaId } : {}), ...(run.automationEvent?.origin ? { origin: run.automationEvent.origin } : {}) });
    }
  });
  return () => { stopStudio(); stopCouncil(); };
}
