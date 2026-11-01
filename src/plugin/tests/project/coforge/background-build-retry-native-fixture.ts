import { mkdir, mkdtemp, realpath, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { vi } from 'vitest';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
import { LocalWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspaces';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { WorkflowWorkspaceRecord } from '../../../features/coforge/application/workflow-workspace-ports';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
export async function retrySourceFixture(folders: string[]) {
  await mkdir(resolve('.nq'), { recursive: true }); const root = await realpath(await mkdtemp(join(resolve('.nq'), 'retry-source-')));
  if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe snapshot fixture'); folders.push(root);
  const project = join(root, 'game'); const vault = join(root, 'vault'); await mkdir(project); await mkdir(vault);
  await writeFile(join(project, 'game.ts'), 'before\n'); await writeFile(join(project, 'removed.txt'), 'remove me'); await writeFile(join(project, 'binary.dat'), Buffer.from([0, 1, 2]));
  await agentGit(project, ['init', '--initial-branch=main']); await agentGit(project, ['add', '--all']);
  await agentGit(project, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Fixture']);
  let records: WorkflowWorkspaceRecord[] = []; const save = vi.fn(async (next: WorkflowWorkspaceRecord[]) => { records = structuredClone(next); });
  const storage = { load: async () => structuredClone(records), save }; const workspaces = new LocalWorkflowWorkspaces(storage); await workspaces.start();
  const source: BackgroundBuildRetrySource & { runId: string; sourceJobId: string; sourceAttemptId: string } = { projectId: 'project', ideaId: 'CF-1', runId: 'run', runRevision: 4, proposalRevision: 'proposal', stepId: 'build',
    sourceKind: 'workspace', sourceJobId: 'old-job', sourceAttemptId: 'old-attempt', projectPath: project };
  const lease = await workspaces.acquire({ runId: source.runId, projectId: source.projectId, attemptId: source.sourceAttemptId!, access: 'editworktree',
    integration: { ...defaultIntegration(), projectPath: project, worktreeFolder: join(root, 'worktrees'), allowImplementation: true } });
  source.sourceWorkspaceId = lease.id;
  await writeFile(join(lease.cwd, 'game.ts'), 'reviewed partial\n'); await unlink(join(lease.cwd, 'removed.txt'));
  await writeFile(join(lease.cwd, 'binary.dat'), Buffer.from([0, 9, 8, 7])); await writeFile(join(lease.cwd, 'new.txt'), 'new untracked');
  source.expectedIncrement = await lease.capture('Prior failed Build'); await lease.release();
  const privateDirectory = join(root, 'worker');
  const resources = new BackgroundBuildRetryResources({ storage, privateDirectory, vaultDirectory: vault,
    protectedVaultFolders: () => ['CoForge', '.obsidian'], assertReady: async () => {} });
  return { root, project, vault, privateDirectory, lease, source, storage, save, resources, workspaces };
}
