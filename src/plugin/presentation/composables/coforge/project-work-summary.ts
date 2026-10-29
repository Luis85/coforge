import { projectIdeas } from '../../../features/coforge/domain/projects';
import type { AppState } from '../../../features/coforge/domain/types';

/** Current request states, scoped to one canonical project; attempts are not completed work. */
export function projectWorkSummary(state: AppState | null) {
  const project = state?.projects?.find(item => item.id === state.activeProjectId);
  if (!state || !project) return null;
  const ideas = projectIdeas(state, project.id);
  return {
    id: project.id,
    name: project.settings.projectName,
    visibility: project.visibility ?? 'public',
    unavailable: Boolean(project.unavailable),
    paused: project.settings.paused,
    requests: ideas.length,
    review: ideas.filter(idea => idea.status === 'review').length,
    flagged: ideas.filter(idea => idea.status === 'flagged').length,
    inbox: ideas.filter(idea => idea.status === 'inbox').length,
    accepted: ideas.filter(idea => idea.status === 'shipped').length,
    active: ideas.filter(idea => idea.status === 'building').length,
  };
}
