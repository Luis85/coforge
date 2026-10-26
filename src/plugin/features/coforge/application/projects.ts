import { record } from '../domain/check';
import { StudioError } from '../domain/errors';
import { settingsPatch } from '../domain/inputs';
import { omit } from '../domain/objects';
import { validateProjectPath, validateProjectUrl } from '../domain/project-note';
import { copySettings, findProject, projectIdFor, projectPaths, selectProjectState } from '../domain/projects';
import { cleanLine, cleanText } from '../domain/sanitize';
import { defaultSettings } from '../domain/seed';
import { isActiveJob } from '../domain/workflow';
import type { StudioProject } from '../domain/types';
import type { StudioStore } from './studio-store';
import { addEvent } from './studio-store';

function values(input: unknown) {
  const source = record(input);
  const settings = settingsPatch(omit(source, 'projectPath', 'worktreeFolder', 'allowImplementation', 'repositoryUrl', 'websiteUrl'));
  const paths = {
    ...(source.projectPath === undefined ? {} : { projectPath: validateProjectPath(source.projectPath) }),
    ...(source.worktreeFolder === undefined ? {} : { worktreeFolder: validateProjectPath(source.worktreeFolder) }),
    ...(source.allowImplementation === undefined ? {} : { allowImplementation: source.allowImplementation }),
    ...(source.repositoryUrl === undefined ? {} : { repositoryUrl: validateProjectUrl(source.repositoryUrl, true) }),
    ...(source.websiteUrl === undefined ? {} : { websiteUrl: validateProjectUrl(source.websiteUrl) }),
  };
  if (paths.allowImplementation !== undefined && typeof paths.allowImplementation !== 'boolean') throw new StudioError('Real implementation must be enabled or disabled.');
  return { settings, paths: { ...paths, ...(typeof paths.allowImplementation === 'boolean' ? { allowImplementation: paths.allowImplementation } : {}) } };
}

export async function addProject(store: StudioStore, input: unknown): Promise<StudioProject> {
  const patch = values(input);
  if (!patch.settings.projectName || !patch.settings.projectBrief) throw new StudioError('Add a project name and a brief of at least 10 characters.');
  const projectName = cleanLine(patch.settings.projectName, 80);
  const projectBrief = cleanText(patch.settings.projectBrief, 8000);
  const projectPath = validateProjectPath(patch.paths.projectPath ?? '', true);
  return store.transaction(state => {
    if (state.projects.length >= 100) throw new StudioError('This vault already contains 100 projects.', 409);
    const defaults = defaultSettings();
    const now = new Date().toISOString();
    while (state.projects.some(project => project.id === projectIdFor(state.nextProjectNumber))) state.nextProjectNumber++;
    const project: StudioProject = {
      id: projectIdFor(state.nextProjectNumber++), createdAt: now, updatedAt: now, projectPath,
      repositoryUrl: patch.paths.repositoryUrl ?? '', websiteUrl: patch.paths.websiteUrl ?? '',
      worktreeFolder: patch.paths.worktreeFolder ?? '', allowImplementation: patch.paths.allowImplementation === true,
      settings: { ...defaults, ...patch.settings, projectName, projectBrief,
        automation: { ...defaults.automation, ...patch.settings.automation }, paused: true },
    };
    state.projects.push(project);
    selectProjectState(state, project.id);
    addEvent(state, 'system', `Project “${project.settings.projectName}” added.`);
    return project;
  });
}

export async function editProject(store: StudioStore, id: string, input: unknown): Promise<StudioProject> {
  const patch = values(input);
  return store.transaction(state => {
    const project = findProject(state, id);
    if (project.unavailable) throw new StudioError('Restore this project note before editing it.', 409);
    if (state.jobs.some(job => job.projectId === id && isActiveJob(job))) throw new StudioError('Finish or cancel this project’s queued runs before editing its configuration.', 409);
    const settings = { ...project.settings, ...patch.settings, automation: { ...project.settings.automation, ...patch.settings.automation } };
    settings.projectName = cleanLine(settings.projectName, 80);
    settings.projectBrief = cleanText(settings.projectBrief, 8000);
    Object.assign(project, patch.paths, { settings, updatedAt: new Date().toISOString() });
    if (project.allowImplementation && !project.projectPath) throw new StudioError('Set the project repository before allowing real implementation.');
    if (id === state.activeProjectId) { state.settings = copySettings(project.settings); Object.assign(state.integration, projectPaths(project)); }
    addEvent(state, 'system', `Project “${project.settings.projectName}” updated.`);
    return project;
  });
}
