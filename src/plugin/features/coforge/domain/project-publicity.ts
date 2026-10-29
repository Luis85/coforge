import type { AppState, Idea } from './types';
import { ideaProjectId, INITIAL_PROJECT_ID } from './projects';

export const PUBLIC_UNAVAILABLE = 'This project or request is unavailable.';
export type ProjectVisibility = 'public' | 'private';
export type ProjectPublicityState = Pick<AppState, 'projects'> & Partial<Pick<AppState, 'runtime'>>;

/** Unset legacy projects stay public; unknown, invalid and unavailable canonical projects fail closed. */
export function projectIsPublic(state: ProjectPublicityState, id: string): boolean {
  if (state.runtime?.publicationDeniedProjectIds?.includes(id)) return false;
  if (state.projects === undefined) return id === INITIAL_PROJECT_ID;
  const project = state.projects.find(item => item.id === id);
  return Boolean(project && !project.unavailable && (project.visibility === undefined || project.visibility === 'public'));
}
export function requestIsPublic(state: ProjectPublicityState, idea: Pick<Idea, 'projectId'>): boolean {
  return projectIsPublic(state, ideaProjectId(idea));
}
export function publicProjectIdeas(state: Pick<AppState, 'ideas'> & ProjectPublicityState): Idea[] {
  if (state.projects === undefined) return state.ideas.filter(idea => requestIsPublic(state, idea));
  const allowed = new Set(state.projects.filter(project => projectIsPublic(state, project.id)).map(project => project.id));
  return state.ideas.filter(idea => allowed.has(ideaProjectId(idea)));
}
export function publicRecognitionState<T extends Pick<AppState, 'ideas'> & ProjectPublicityState>(state: T): T {
  return { ...state, ideas: publicProjectIdeas(state) };
}
