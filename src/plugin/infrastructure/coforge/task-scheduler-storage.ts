import type { Plugin } from 'obsidian';
import type { TaskSchedulerStorage } from '../../features/coforge/application/task-scheduler-ports';
import { emptyTaskScheduler, taskSchedulerStateCheck, type TaskSchedulerState } from '../../features/coforge/domain/scheduled-task';
import { readJson, writeJson } from './atomic-json';

/** Private plugin data, with compare-before-write and the standard complete-generation backup. */
export class TaskSchedulerStateStorage implements TaskSchedulerStorage {
  private identity: string | undefined;
  private readonly path: string;
  constructor(private readonly plugin: Plugin) { this.path = `${plugin.manifest.dir ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`}/coforge-task-scheduler.json`; }
  async load(): Promise<TaskSchedulerState> {
    const state = await readJson(this.plugin.app.vault.adapter, this.path, taskSchedulerStateCheck) ?? emptyTaskScheduler();
    this.identity = JSON.stringify(state); return state;
  }
  async save(state: TaskSchedulerState): Promise<void> {
    const current = await readJson(this.plugin.app.vault.adapter, this.path, taskSchedulerStateCheck) ?? emptyTaskScheduler();
    if (this.identity === undefined || JSON.stringify(current) !== this.identity) throw new Error('Task scheduler state changed outside this editor. Refresh before saving.');
    await writeJson(this.plugin.app.vault.adapter, this.path, state, taskSchedulerStateCheck);
    this.identity = JSON.stringify(state);
  }
}
