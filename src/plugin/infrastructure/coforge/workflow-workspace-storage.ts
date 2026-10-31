import type { Plugin } from "obsidian";
import type {
  WorkflowWorkspaceRecord,
  WorkflowWorkspaceStorage,
} from "../../features/coforge/application/workflow-workspace-ports";
import { workflowWorkspaceRecordsCheck as validate } from './workflow-workspace-check';
/** Private metadata only; unreadable journals fail closed instead of discarding holds. */
export class WorkflowWorkspaceStateStorage implements WorkflowWorkspaceStorage {
  constructor(private readonly plugin: Plugin) {}
  private get path(): string {
    const { app, manifest } = this.plugin;
    return `${manifest.dir ?? `${app.vault.configDir}/plugins/${manifest.id}`}/coforge-workspaces.json`;
  }
  async load(): Promise<WorkflowWorkspaceRecord[]> {
    try {
      const adapter = this.plugin.app.vault.adapter;
      if (!(await adapter.exists(this.path))) return [];
      const info = await adapter.stat(this.path);
      if (!info || info.type !== "file" || info.size > 8 * 1024 * 1024)
        throw new Error("limit");
      const raw = await adapter.read(this.path);
      if (Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error("limit");
      return validate(JSON.parse(raw));
    } catch {
      throw new Error(
        "The private workflow workspace journal could not be loaded. Restore it before running agents.",
      );
    }
  }
  async save(records: WorkflowWorkspaceRecord[]): Promise<void> {
    try {
      const raw = JSON.stringify(validate(records), null, 2);
      if (Buffer.byteLength(raw) > 8 * 1024 * 1024) throw new Error("limit");
      await this.plugin.app.vault.adapter.write(this.path, raw);
    } catch {
      throw new Error(
        "The private workflow workspace journal could not be saved. No further workspace operations are allowed.",
      );
    }
  }
}
