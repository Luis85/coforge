import { coforgeDataPath, CoforgeDataDirectory } from './vault-data-location';
import type { Plugin } from 'obsidian';
import type { WorkflowTriggerStorage } from '../../features/coforge/application/workflow-trigger-ports';
import { emptyWorkflowTriggers, workflowTriggerStateCheck, type WorkflowTriggerState } from '../../features/coforge/domain/workflow-triggers';
import { readJson, writeJson } from './atomic-json';
export class WorkflowTriggerStateStorage implements WorkflowTriggerStorage {
  private readonly dataDirectory = new CoforgeDataDirectory(() => this.plugin);
  private identity: string | undefined;
  private readonly path: string;
  constructor(private readonly plugin: Plugin) { this.path = coforgeDataPath('coforge-workflow-triggers.json'); }
  async load(): Promise<WorkflowTriggerState> {
    await this.dataDirectory.prepare(); const state = await readJson(this.plugin.app.vault.adapter, this.path, workflowTriggerStateCheck) ?? emptyWorkflowTriggers(); this.identity = JSON.stringify(state); return state; }
  async save(state: WorkflowTriggerState): Promise<void> {
    await this.dataDirectory.prepare();
    const current = await readJson(this.plugin.app.vault.adapter, this.path, workflowTriggerStateCheck) ?? emptyWorkflowTriggers();
    if (this.identity === undefined || JSON.stringify(current) !== this.identity) throw new Error('Workflow triggers changed outside this editor. Refresh before saving.');
    await writeJson(this.plugin.app.vault.adapter, this.path, state, workflowTriggerStateCheck); this.identity = JSON.stringify(state);
  }
}
