import type { WorkflowWorkspaceRecord, WorkflowWorkspaceStorage } from '../../../features/coforge/application/workflow-workspace-ports';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { LocalWorkflowWorkspaces } from '../workflow-workspaces';
import { WorkerFiles } from './files';

class WorkerWorkspaceStorage implements WorkflowWorkspaceStorage {
  constructor(private readonly files: WorkerFiles) {}
  async load(): Promise<WorkflowWorkspaceRecord[]> { return workflowWorkspaceRecordsCheck(await this.files.read('workspaces.json', 8 * 1024 * 1024) ?? []); }
  async save(records: WorkflowWorkspaceRecord[]): Promise<void> { await this.files.write('workspaces.json', workflowWorkspaceRecordsCheck(records)); }
}
export function workerWorkspaces(files: WorkerFiles): LocalWorkflowWorkspaces { return new LocalWorkflowWorkspaces(new WorkerWorkspaceStorage(files), files.directory, 'bg-'); }
