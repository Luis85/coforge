import { workflowDefinition, workflowDefinitionCheck } from '../domain/configured-workflow';
import { StudioError } from '../domain/errors';
import { copySettings, findProject } from '../domain/projects';
import type { StudioProject } from '../domain/types';
import { recordOperation } from './population';
import type { StudioStore } from './studio-store';
import type { AppState } from '../domain/types';
import { ideaProjectId } from '../domain/projects';

export function projectHasPendingWorkflow(state: Pick<AppState, 'ideas'>, projectId: string): boolean {
  return state.ideas.some(idea => ideaProjectId(idea) === projectId && (idea.workflowRun && !['finished', 'stopped'].includes(idea.workflowRun.state) ||
    idea.polishingRuns?.some(pass => pass.review === 'pending' && !['finished', 'stopped'].includes(pass.workflow.state))));
}

/** A definition revision affects future runs only; pinned execution snapshots remain untouched. */
export async function saveProjectWorkflow(store: StudioStore, projectId: string, input: unknown, expectedIdentity: string): Promise<StudioProject> {
  const definition = workflowDefinitionCheck(input);
  return store.transaction(state => {
    const project = findProject(state, projectId);
    if (project.unavailable) throw new StudioError('Restore this project note before configuring its workflow.', 409);
    if (JSON.stringify(workflowDefinition(project.settings)) !== expectedIdentity)
      throw new StudioError('The workflow changed outside this editor. Your draft was preserved; review the saved version before replacing it.', 409);
    const workflow = { ...structuredClone(definition), revision: crypto.randomUUID() };
    project.settings = { ...copySettings(project.settings), workflow };
    project.updatedAt = new Date().toISOString();
    if (state.activeProjectId === projectId) state.settings = copySettings(project.settings);
    recordOperation(state, 'workflow-definition-updated', 'committed', undefined, 1, projectId);
    return structuredClone(project);
  });
}
