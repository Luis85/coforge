import { StudioError } from './errors';
import type { AppState, Idea, IntegrationSettings, Settings, StudioProject } from './types';

export const INITIAL_PROJECT_ID = 'CFP-001';
export const projectIdFor = (number: number): string => `CFP-${String(number).padStart(3, '0')}`;
export const PROJECTS_FOLDER = 'CoForge/Projects';
export type ProjectPaths = Pick<IntegrationSettings, 'projectPath' | 'worktreeFolder' | 'allowImplementation'>;
export interface ProjectState extends AppState { projects: StudioProject[]; activeProjectId: string; integration: IntegrationSettings }

export const copySettings = (settings: Settings): Settings => ({ ...settings, automation: { ...settings.automation }, ...(settings.stagePrompts ? { stagePrompts: { ...settings.stagePrompts } } : {}) });
export const projectPaths = (project: ProjectPaths): ProjectPaths => ({
  projectPath: project.projectPath, worktreeFolder: project.worktreeFolder, allowImplementation: project.allowImplementation,
});
export function initialProject(settings: Settings, integration: ProjectPaths, now: string): StudioProject {
  return { id: INITIAL_PROJECT_ID, settings: copySettings(settings), ...projectPaths(integration), repositoryUrl: '', websiteUrl: '', createdAt: now, updatedAt: now };
}
export function findProject(state: Pick<AppState, 'projects'>, id: string): StudioProject {
  const project = state.projects?.find(item => item.id === id);
  if (!project) throw new StudioError('Project not found.', 404);
  return project;
}
export const ideaProjectId = (idea: Pick<Idea, 'projectId'>): string => idea.projectId ?? INITIAL_PROJECT_ID;
export const projectIdeas = (state: Pick<AppState, 'ideas' | 'activeProjectId'>, id = state.activeProjectId ?? INITIAL_PROJECT_ID): Idea[] =>
  state.ideas.filter(idea => ideaProjectId(idea) === id);

/** Legacy UI settings remain a projection of the selected note-backed project. */
export function synchronizeProject(state: ProjectState): void {
  if (!state.activeProjectId) return;
  const project = findProject(state, state.activeProjectId);
  if (project.unavailable) return;
  const settings = copySettings(state.settings);
  const paths = projectPaths(state.integration);
  if (JSON.stringify([settings, paths]) !== JSON.stringify([project.settings, projectPaths(project)])) project.updatedAt = new Date().toISOString();
  Object.assign(project, paths, { settings });
}

export function selectProjectState(state: ProjectState, id: string): void {
  const project = findProject(state, id);
  if (project.unavailable) throw new StudioError('Restore this project note before selecting it.', 409);
  synchronizeProject(state);
  state.activeProjectId = id;
  state.settings = copySettings(project.settings);
  Object.assign(state.integration, projectPaths(project));
  state.runtime.projectPath = project.projectPath || null;
  state.runtime.allowImplementation = project.allowImplementation;
}

export function projectSettings(state: ProjectState, id: string): Settings {
  return id === state.activeProjectId ? state.settings : findProject(state, id).settings;
}
