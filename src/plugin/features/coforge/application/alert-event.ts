import type { StudioEvent } from './studio-events';
import type { AppState } from '../domain/types';
import { buildPublicBoard } from '../domain/public-board';
import { projectIsPublic } from '../domain/project-publicity';
import { ideaProjectId } from '../domain/projects';
import { ALERT_EVENTS } from '../domain/alerts';

/** Resolve identity privately, then construct variables from the existing public projection. */
export function publicAlertVariables(event: StudioEvent, state: AppState): Record<string, string> | null {
  if (event.record.effect !== 'committed' || !ALERT_EVENTS.some(type => type === event.type)) return null;
  if (event.record.playerId?.startsWith('simulator:')) return null;
  const entity = event.record.entityId;
  const job = state.jobs.find(item => item.id === entity);
  const runIdea = state.ideas.find(item => item.workflowRun?.id === entity || item.workflowHistory?.some(run => run.id === entity));
  const idea = state.ideas.find(item => item.id === (job?.ideaId ?? entity)) ?? runIdea;
  if (['request-created', 'bug-created', 'vote-counted', 'job-completed', 'workflow-run-finished', 'workflow-run-awaiting-review'].includes(event.type) && !idea) return null;
  const project = state.projects?.find(item => item.id === (job?.projectId ?? (idea ? ideaProjectId(idea) : entity)));
  if (project && !projectIsPublic(state, project.id)) return null;
  const variables: Record<string, string> = { event: event.type, count: String(event.record.count) };
  if (idea) {
    const projectId = ideaProjectId(idea);
    if (!projectIsPublic(state, projectId)) return null;
    const board = buildPublicBoard({ ...state, activeProjectId: projectId });
    const visible = board.columns.flatMap(column => column.ideas).find(item => item.id === idea.id);
    if (visible) Object.assign(variables, { request: visible.id, title: visible.title, viewer: visible.author, project: board.project });
  }
  // A viewer name is intentionally a display name; raw platform identities never cross this boundary.
  const contributor = state.contributors.find(item => item.id === event.record.playerId);
  if (contributor) variables.viewer = contributor.name;
  return variables;
}
