import { oneOf, record } from '../domain/check';
import { StudioError } from '../domain/errors';
import { settingsPatch } from '../domain/inputs';
import { omit } from '../domain/objects';
import { validateProjectPath, validateProjectUrl } from '../domain/project-note';
import { copySettings, findProject, projectConfigurationIdentity, projectIdFor, projectPaths, selectProjectState } from '../domain/projects';
import { cleanLine, cleanText } from '../domain/sanitize';
import { defaultSettings } from '../domain/seed';
import { isActiveJob } from '../domain/workflow';
import type { StudioProject } from '../domain/types';
import type { StudioStore } from './studio-store';
import { addEvent } from './studio-store';
import { recordOperation } from './population';
import { normalizeStagePrompts } from '../domain/stage-prompts';
import { normalizeStageAgents } from '../domain/stage-agents';
import { projectHasPendingWorkflow } from './workflow-configuration';
import { projectFeatureGroupsCheck } from '../domain/project-feature-groups';

function values(input: unknown) {
  const source = record(input);
  if (source.workflow !== undefined) throw new StudioError('Use Workflow settings to save a workflow with its source revision.', 409);
  const settings = settingsPatch(omit(source, 'projectPath', 'worktreeFolder', 'allowImplementation', 'repositoryUrl', 'websiteUrl', 'visibility', 'featureGroups'));
  if (settings.agentPrompt !== undefined) settings.agentPrompt = cleanText(settings.agentPrompt, 8000);
  if (settings.stagePrompts !== undefined) settings.stagePrompts = normalizeStagePrompts(settings.stagePrompts);
  if (settings.stageAgents !== undefined) settings.stageAgents = normalizeStageAgents(settings.stageAgents);
  const paths = {
    ...(source.featureGroups === undefined ? {} : { featureGroups: projectFeatureGroupsCheck(source.featureGroups) }),
    ...(source.visibility === undefined ? {} : { visibility: oneOf(['public', 'private'] as const)(source.visibility) }),
    ...(source.projectPath === undefined ? {} : { projectPath: validateProjectPath(source.projectPath) }),
    ...(source.worktreeFolder === undefined ? {} : { worktreeFolder: validateProjectPath(source.worktreeFolder) }),
    ...(source.allowImplementation === undefined ? {} : { allowImplementation: source.allowImplementation }),
    ...(source.repositoryUrl === undefined ? {} : { repositoryUrl: validateProjectUrl(source.repositoryUrl, true) }),
    ...(source.websiteUrl === undefined ? {} : { websiteUrl: validateProjectUrl(source.websiteUrl) }),
  };
  if (paths.allowImplementation !== undefined && typeof paths.allowImplementation !== 'boolean') throw new StudioError('Real implementation must be enabled or disabled.');
  return { settings, paths: { ...omit(paths, 'allowImplementation'), ...(typeof paths.allowImplementation === 'boolean' ? { allowImplementation: paths.allowImplementation } : {}) } };
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
      visibility: patch.paths.visibility ?? 'public',
      ...(patch.paths.featureGroups === undefined ? {} : { featureGroups: patch.paths.featureGroups }),
      worktreeFolder: patch.paths.worktreeFolder ?? '', allowImplementation: patch.paths.allowImplementation === true,
      settings: { ...defaults, ...patch.settings, projectName, projectBrief,
        automation: { ...defaults.automation, ...patch.settings.automation }, paused: true },
    };
    state.projects.push(project);
    if (project.settings.agentPrompt) recordOperation(state, 'project-prompt-updated', 'committed', undefined, 1, project.id);
    if (Object.keys(project.settings.stageAgents ?? {}).length) recordOperation(state, 'project-stage-agents-updated', 'committed', undefined, 1, project.id);
    selectProjectState(state, project.id);
    addEvent(state, 'system', `Project “${project.settings.projectName}” added.`);
    return project;
  });
}

export async function editProject(store: StudioStore, id: string, input: unknown, expectedConfiguration?: string): Promise<StudioProject> {
  const patch = values(input);
  return store.transaction(state => {
    const project = findProject(state, id);
    if (expectedConfiguration !== undefined && expectedConfiguration !== projectConfigurationIdentity(project))
      throw new StudioError('Project settings changed outside this form. Review the latest configuration before saving; your draft was not written.', 409);
    const previousPrompt = project.settings.agentPrompt;
    const previousStages = JSON.stringify(project.settings.stagePrompts ?? {});
    const previousAgents = JSON.stringify([project.settings.provider, project.settings.model, project.settings.stageAgents ?? {}]);
    const previousVisibility = project.visibility ?? 'public';
    if (project.unavailable) throw new StudioError('Restore this project note before editing it.', 409);
    const settings = { ...project.settings, ...patch.settings, automation: { ...project.settings.automation, ...patch.settings.automation } };
    const metadataOnly = (patch.paths.visibility !== undefined || patch.paths.featureGroups !== undefined) && projectConfigurationIdentity({ ...project, ...patch.paths, settings, visibility: project.visibility, featureGroups: project.featureGroups }) === projectConfigurationIdentity(project);
    if (!metadataOnly && projectHasPendingWorkflow(state, id)) throw new StudioError('Finish, stop or review this project’s workflow runs before changing project settings. Future workflow definitions can still be edited in Workflow settings.', 409);
    if (!metadataOnly && state.jobs.some(job => job.projectId === id && isActiveJob(job))) throw new StudioError('Finish or cancel this project’s queued runs before editing its configuration.', 409);
    settings.projectName = cleanLine(settings.projectName, 80);
    settings.projectBrief = cleanText(settings.projectBrief, 8000);
    Object.assign(project, patch.paths, { settings, updatedAt: new Date().toISOString() });
    if (previousVisibility !== (project.visibility ?? 'public')) recordOperation(state, 'project-visibility-updated', 'committed', undefined, 1, project.id);
    if (previousPrompt !== settings.agentPrompt) recordOperation(state, 'project-prompt-updated', 'committed', undefined, 1, project.id);
    if (previousStages !== JSON.stringify(settings.stagePrompts ?? {})) recordOperation(state, 'project-stage-prompts-updated', 'committed', undefined, 1, project.id);
    if (previousAgents !== JSON.stringify([settings.provider, settings.model, settings.stageAgents ?? {}])) recordOperation(state, 'project-stage-agents-updated', 'committed', undefined, 1, project.id);
    if (project.allowImplementation && !project.projectPath) throw new StudioError('Set the project repository before allowing real implementation.');
    if (id === state.activeProjectId) { state.settings = copySettings(project.settings); Object.assign(state.integration, projectPaths(project)); }
    addEvent(state, 'system', `Project “${project.settings.projectName}” updated.`);
    return project;
  });
}
