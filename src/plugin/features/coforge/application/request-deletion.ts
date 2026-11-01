import type { Idea } from '../domain/types';
import type { InternalState } from './ports';
import type { StudioStore } from './studio-store';
import { contextEventId } from '../domain/integrity';
import { ideaProjectId, findProject } from '../domain/projects';
import { isActiveJob } from '../domain/workflow';
import { uncertainTaskAttempt } from './agent-task';
import { assertPolishingMetadata } from './workflow-run-owner';
import { assertDurableWorkflowMetadata } from './workflow-stop-policy';
import { deletedRequestsCheck, requestDeletionPreviewCheck, type DeletedRequest, type RequestDeletionPreview } from '../domain/request-deletion';
import { addEvent } from './studio-state';
import { ideaBody, ideaProperties } from '../domain/idea-note';

export function requestDeletionProblem(state: Pick<InternalState, 'ideas' | 'jobs'>, idea: Idea): string {
  const jobs = state.jobs.filter(job => job.ideaId === idea.id);
  if (jobs.some(job => isActiveJob(job) || job.durable && !job.durable.acknowledged)) return 'Finish or stop active and queued work, then acknowledge recovery before deleting this request.';
  if (jobs.some(job => job.nativeProcess && job.nativeProcess.phase !== 'terminated' && !job.nativeProcess.operatorAcknowledgedAt)) return 'Inspect and acknowledge the original native process before deleting this request.';
  if (idea.workflowRun && !['finished', 'stopped', 'awaiting-review'].includes(idea.workflowRun.state)) return 'Finish or explicitly stop this workflow before deleting its request.';
  if (idea.polishingRuns?.some(pass => pass.review === 'pending')) return 'Review or dismiss the pending polishing pass before deleting this request.';
  const runs = [idea.workflowRun, ...(idea.workflowHistory ?? []), ...(idea.polishingRuns ?? []).map(pass => pass.workflow)];
  if (runs.some(run => run?.attempts.some(attempt => uncertainTaskAttempt(attempt) || attempt.councilCancellation === 'requested'))) return 'Resolve the uncertain task or cancellation before deleting this request.';
  return '';
}
const identity = (state: InternalState, idea: Idea): string => contextEventId(JSON.stringify([idea, state.jobs.filter(job => job.ideaId === idea.id), state.workflowStopHolds?.includes(idea.id)]));
function target(state: InternalState, id: string): Idea {
  const idea = state.ideas.find(item => item.id === id);
  if (!idea) throw new Error('Request not found.');
  if (findProject(state, ideaProjectId(idea)).unavailable) throw new Error('Restore this project note before deleting its request.');
  assertPolishingMetadata(state, id); assertDurableWorkflowMetadata(state, id);
  const problem = requestDeletionProblem(state, idea); if (problem) throw new Error(problem);
  return idea;
}
export async function previewRequestDeletion(store: StudioStore, id: string): Promise<RequestDeletionPreview> {
  const state = store.internalSnapshot(); const idea = target(state, id); const stateKey = identity(state, idea);
  const notes = await store.previewRequestNotes([id]);
  const current = store.internalSnapshot();
  if (identity(current, target(current, id)) !== stateKey || !notes[id]) throw new Error('This request changed while preparing deletion. Review a fresh preview.');
  return { ideaId: id, projectId: ideaProjectId(idea), title: idea.title, stateKey, noteFingerprint: notes[id] };
}
export async function deleteRequest(store: StudioStore, input: RequestDeletionPreview,
  assertHost?: (ids: readonly string[]) => void | (() => void) | Promise<void | (() => void)>): Promise<void> {
  const preview = requestDeletionPreviewCheck(input);
  const release = await assertHost?.([preview.ideaId]);
  try {
    await store.transaction(state => {
      const idea = target(state, preview.ideaId);
      if (identity(state, idea) !== preview.stateKey || ideaProjectId(idea) !== preview.projectId || idea.title !== preview.title) throw new Error('This request changed. Review a fresh deletion preview.');
      const project = findProject(state, ideaProjectId(idea));
      const proposal = { ...idea, workflowRun: undefined, workflowHistory: undefined, polishingRuns: undefined, polishingAmendments: undefined };
      const retained: DeletedRequest = { id: idea.id, title: idea.title, projectId: project.id, projectName: project.settings.projectName,
        proposal: { properties: ideaProperties(proposal, state.contributors.find(person => person.id === idea.authorId)?.name ?? idea.authorId), body: ideaBody(idea) },
        createdAt: idea.createdAt, deletedAt: new Date().toISOString(), voters: [...idea.voters],
        ...(idea.increment ? { increment: structuredClone(idea.increment) } : {}),
        ...(idea.workflowRun ? { workflowRun: structuredClone(idea.workflowRun) } : {}),
        ...(idea.workflowHistory ? { workflowHistory: structuredClone(idea.workflowHistory) } : {}),
        ...(idea.polishingRuns ? { polishingRuns: structuredClone(idea.polishingRuns) } : {}),
        ...(idea.polishingAmendments ? { polishingAmendments: structuredClone(idea.polishingAmendments) } : {}) };
      (state.deletedRequests ??= []).push(...deletedRequestsCheck([retained]));
      state.ideas = state.ideas.filter(item => item.id !== idea.id);
      state.manualHolds = state.manualHolds.filter(id => id !== idea.id);
      state.workflowStopHolds = state.workflowStopHolds?.filter(id => id !== idea.id);
      if (state.requestOrigins) delete state.requestOrigins[idea.id];
      addEvent(state, 'system', `${idea.id} was deleted from the board; its note and private history are retained for recovery.`, idea.id);
    }, { requestDeletion: { notes: { [preview.ideaId]: preview.noteFingerprint } } });
  } finally { if (typeof release === 'function') release(); }
}
