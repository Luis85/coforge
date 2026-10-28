import type { Plugin } from 'obsidian';
import type { StudioService } from '../../features/coforge/application/studio';
import type { CouncilActions, CouncilRuntimeSnapshot } from '../../features/coforge/application/council-ports';
import type { TaskSchedulerHost } from '../../features/coforge/application/task-scheduler-ports';
import { resolveCouncilPlan, type CouncilTarget } from '../../features/coforge/application/council-execution';
import { reviewedCouncilIdentity } from '../../features/coforge/application/reviewed-preflight';
import { SCHEDULED_TASK_FOLDER, scheduledOccurrencePath, type TaskDraft } from '../../features/coforge/domain/scheduled-task';
import { normalizeVaultFolder, vaultFoldersOverlap } from '../../features/coforge/domain/vault-folder-policy';
import { protectCouncilPrivatePaths } from './council-private-data';

function target(task: TaskDraft): CouncilTarget {
  return { kind: task.destination.kind === 'council' ? 'council' : 'agent',
    id: task.destination.kind === 'team' ? task.destination.assigneeId ?? '' : task.destination.id, teamId: task.destination.teamId };
}
/** Scheduled work enters the same reviewed-snapshot admission as manual Council work. */
export function taskSchedulerHost(plugin: Plugin, studio: StudioService, council: CouncilActions): TaskSchedulerHost {
  let latest: CouncilRuntimeSnapshot | undefined;
  let activeRuns = new Set<string>();
  const refresh = () => { latest = council.snapshot(); activeRuns = new Set(latest.runs.filter(run => !['completed', 'cancelled'].includes(run.state)).map(run => run.id)); return latest; };
  const configured = () => {
    const state = refresh();
    if (!state.ready || !state.executor) throw new Error('Designate this desktop in Council → Run monitor before changing task schedules.');
  };
  const path = (value: string) => {
    const normalized = normalizeVaultFolder(value);
    if (!normalized.endsWith('.md') || [studio.integration().publicFolder, 'CoForge/Public', plugin.app.vault.configDir, '.git'].some(folder => vaultFoldersOverlap(normalized, folder))) throw new Error('Context must be an explicit private Markdown note outside configuration and public exports.');
    const file = plugin.app.vault.getFileByPath(normalized);
    if (!file) throw new Error('A selected context note is missing. Repair the schedule before dispatch.');
    return file;
  };
  const validate = async (task: TaskDraft) => {
    if (!studio.state().projects?.some(project => project.id === task.projectId && !project.unavailable)) throw new Error('Choose an available project for this schedule.');
    const plan = resolveCouncilPlan(await council.catalogue.list(), target(task));
    if (plan.team.projectId !== task.projectId || plan.definition.projectId !== task.projectId) throw new Error('The selected team and destination must belong to this project.');
    for (const value of task.contextPaths) path(value);
  };
  return {
    owned: () => { const state = refresh(); return state.ready && state.executor; },
    configure: async () => { await council.assertExecutor?.(); configured(); }, validate,
    readiness(projectId) {
      const state = refresh();
      if (!state.ready || !state.executor) return { ready: false, reason: 'This is not the designated execution desktop; skipped.' };
      if (state.paused || state.preferences.pausedProjectIds?.includes(projectId)) return { ready: false, reason: 'Council or project execution is paused; skipped.' };
      if (!studio.state().projects?.some(project => project.id === projectId && !project.unavailable)) return { ready: false, reason: 'The project is unavailable; skipped.' };
      if (state.runs.filter(run => !['completed', 'cancelled'].includes(run.state)).length >= 50) return { ready: false, reason: 'The execution queue reached its 50-run limit; skipped.' };
      return { ready: true, reason: '' };
    },
    active: runId => { if (!latest) refresh(); return activeRuns.has(runId); },
    openSource: async value => { const file = path(value); await plugin.app.workspace.getLeaf('tab').openFile(file); },
    async dispatch(task, occurrence, signal) {
      await council.assertExecutor?.(); configured(); signal.throwIfAborted(); await validate(task);
      let markdown = `# ${task.title}\n\n${task.prompt}\n\n`;
      for (const value of task.contextPaths) {
        signal.throwIfAborted(); const file = path(value); const content = await plugin.app.vault.read(file);
        markdown += `## Context snapshot: ${file.path}\n\n${content}\n\n`;
        if (markdown.length > 64000) throw new Error('Scheduled prompt and context exceed 64000 characters. Nothing was truncated.');
      }
      signal.throwIfAborted();
      await protectCouncilPrivatePaths(plugin, [SCHEDULED_TASK_FOLDER], studio.integration().publicFolder);
      const sourcePath = scheduledOccurrencePath(occurrence.id);
      if (plugin.app.vault.getAbstractFileByPath(sourcePath)) throw new Error('The occurrence source already exists. Inspect the previous admission before recovery.');
      signal.throwIfAborted(); await plugin.app.vault.create(sourcePath, markdown);
      const preview = await council.preflight(target(task), sourcePath);
      configured(); signal.throwIfAborted();
      const run = await council.submit(target(task), sourcePath, reviewedCouncilIdentity(preview));
      return { runId: run.id, sourcePath };
    },
  };
}
