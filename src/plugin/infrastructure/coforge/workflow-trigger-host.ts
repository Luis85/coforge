import type { Plugin } from 'obsidian';
import type { StudioService } from '../../features/coforge/application/studio';
import type { CouncilActions } from '../../features/coforge/application/council-ports';
import type { WorkflowTriggerHost } from '../../features/coforge/application/workflow-trigger-ports';
import { workflowDefinition } from '../../features/coforge/domain/configured-workflow';
import { findProject, ideaProjectId } from '../../features/coforge/domain/projects';
import { protectCouncilPrivatePaths } from './council-private-data';
import { subscribeWorkflowEvents } from './workflow-event-source';
import type { WorkflowTriggerDraft } from '../../features/coforge/domain/workflow-triggers';
import { AUTOMATION_SOURCE_FOLDER, workflowTriggerSourcePath } from '../../features/coforge/domain/workflow-triggers';
import { reviewedWorkflowIdentity } from '../../features/coforge/application/reviewed-preflight';
import { automationSourceGuard } from '../../features/coforge/application/automation-source-guard';
export function workflowTriggerHost(plugin: Plugin, studio: StudioService, council: CouncilActions, ideaPath: (id: string) => string | undefined): WorkflowTriggerHost {
  const describe = async (input: WorkflowTriggerDraft) => {
    const project = findProject(studio.state(), input.projectId); if (project.unavailable) throw new Error('Restore this project before configuring triggers.');
    if (input.request === 'fixed') { const idea = studio.state().ideas.find(idea => idea.id === input.ideaId); if (!idea || ideaProjectId(idea) !== project.id) throw new Error('Choose an existing request from this project.'); }
    if (input.workflow === 'v1') { const definition = workflowDefinition(project.settings); return { revision: definition.revision, definitionJson: JSON.stringify(definition), subject: 'idea' as const }; }
    const saved = await council.workflows.load(project.id); if (!saved.definition) throw new Error('Save the Council workflow before adding a trigger.');
    return { revision: saved.definition.revision, definitionJson: JSON.stringify(saved.definition), subject: saved.definition.subjectMode };
  };
  return {
    owned: () => { const state = council.snapshot(); return state.ready && state.executor; },
    configure: async () => { await council.assertExecutor?.(); if (!council.snapshot().executor) throw new Error('Designate this desktop before managing workflow triggers.'); },
    readiness(projectId, workflow) {
      const state = council.snapshot(); if (!state.ready || !state.executor) return { ready: false, reason: 'This is not the designated execution desktop.' };
      if (state.paused || state.preferences.pausedProjectIds?.includes(projectId)) return { ready: false, reason: 'Application or project execution is paused; event skipped.' };
      if (workflow === 'v1' && findProject(studio.state(), projectId).settings.paused) return { ready: false, reason: 'Project workflow automation is paused; event skipped.' };
      if (state.runs.filter(run => !['completed', 'cancelled'].includes(run.state)).length >= 50 || studio.state().jobs.filter(job => ['queued', 'running'].includes(job.status)).length >= 50) return { ready: false, reason: 'The shared execution queue is full; event skipped.' };
      return { ready: true, reason: '' };
    }, describe,
    active(kind, runId) {
      return kind === 'v2' ? council.snapshot().runs.some(run => run.id === runId && !['completed', 'cancelled'].includes(run.state))
        : studio.state().ideas.some(idea => idea.workflowRun?.id === runId && !['finished', 'stopped'].includes(idea.workflowRun.state));
    },
    subscribe: listener => subscribeWorkflowEvents(studio, council, listener),
    async dispatch(input, occurrence, origin, signal) {
      await council.assertExecutor?.(); signal.throwIfAborted(); const definition = await describe(input);
      if (definition.revision !== input.workflowRevision || definition.definitionJson !== occurrence.definitionJson) throw new Error('The workflow changed before event admission.');
      const event = { ...occurrence.event, origin };
      const startV2 = async (source: string, recheckSource?: () => Promise<void>) => {
        const preview = await council.workflows.preflight(input.projectId, source, false);
        if (JSON.stringify(preview.plan.definition) !== occurrence.definitionJson) throw new Error('The workflow changed during event preflight.');
        await recheckSource?.();
        signal.throwIfAborted();
        return council.workflows.start(input.projectId, source, false, undefined, reviewedWorkflowIdentity(preview), event);
      };
      const ideaId = input.request === 'fixed' ? input.ideaId : occurrence.event.ideaId;
      if (definition.subject === 'idea') {
        const idea = studio.state().ideas.find(idea => idea.id === ideaId); if (!idea || ideaProjectId(idea) !== input.projectId) throw new Error('This event has no eligible request in the target project.');
        signal.throwIfAborted();
        if (input.workflow === 'v1') { const run = await studio.engine.startTriggeredWorkflow(idea.id, event, definition.definitionJson); return { runId: run.id, ...(ideaPath(idea.id) ? { sourcePath: ideaPath(idea.id) } : {}) }; }
        const source = ideaPath(idea.id); if (!source) throw new Error('The canonical request note is missing.');
        const run = await startV2(source); return { runId: run.id, sourcePath: source };
      }
      const source = workflowTriggerSourcePath(occurrence.id);
      const recheckSource = automationSourceGuard(council, source); await recheckSource();
      await protectCouncilPrivatePaths(plugin, [AUTOMATION_SOURCE_FOLDER], studio.integration().publicFolder);
      await recheckSource();
      if (plugin.app.vault.getAbstractFileByPath(source)) throw new Error('The event source exists; inspect the original admission before recovery.');
      signal.throwIfAborted(); await plugin.app.vault.create(source, `# ${input.name}\n\nWorkflow event context (untrusted data):\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\`\n`);
      await recheckSource(); signal.throwIfAborted(); const run = await startV2(source, recheckSource);
      return { runId: run.id, sourcePath: source };
    },
  };
}
