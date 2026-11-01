import { mkdir, mkdtemp, readFile, realpath, rm, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
import { LocalWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspaces';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { WorkflowWorkspaceRecord } from '../../../features/coforge/application/workflow-workspace-ports';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
async function fixture() {
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
  const resources = new BackgroundBuildRetryResources({ storage, privateDirectory: join(root, 'worker'), vaultDirectory: vault,
    protectedVaultFolders: () => ['CoForge', '.obsidian'], assertReady: async () => {} });
  return { root, project, lease, source, storage, save, resources };
}
it('privately captures exact reviewed text/binary/deletions/untracked bytes without adopting or modifying the old workspace', async () => {
  const f = await fixture(); const before = JSON.stringify(await f.storage.load()); const saves = f.save.mock.calls.length;
  const inspection = await f.resources.inspect(f.source);
  expect(inspection).toMatchObject({ sourceKind: 'workspace', sourceWorkspaceId: f.lease.id, fileCount: 4, humanCessationRequired: true });
  expect(inspection.increment?.files.map(file => file.path)).toEqual(expect.arrayContaining(['game.ts', 'removed.txt', 'binary.dat', 'new.txt']));
  expect(inspection.snapshot.contentHash).toMatch(/^[a-f0-9]{64}$/u);
  await f.resources.verify(f.source, inspection.snapshot, { kind: 'retry', runId: f.source.runId, retryId: 'retry', jobId: 'new-job', attemptId: 'new-attempt' });
  expect(JSON.stringify(await f.storage.load())).toBe(before); expect(f.save).toHaveBeenCalledTimes(saves);
  expect(await readFile(join(f.lease.cwd, 'game.ts'), 'utf8')).toBe('reviewed partial\n');
  await writeFile(join(f.lease.cwd, 'new.txt'), 'changed after review');
  await expect(f.resources.verify(f.source, inspection.snapshot, { kind: 'retry', runId: f.source.runId, retryId: 'other', jobId: 'other-job', attemptId: 'other-attempt' })).rejects.toThrow(/changed|inspect|review/u);
}, 90000);
it('rejects protected source changes before an import can be authorized', async () => {
  const f = await fixture(); await mkdir(join(f.lease.cwd, '.coforge')); await writeFile(join(f.lease.cwd, '.coforge', 'control.json'), '{}');
  await expect(f.resources.inspect(f.source)).rejects.toThrow(/protected|permitted/u);
}, 90000);
it('permits only an explicitly clean captured repository with no retained workspace evidence', async () => {
  const f = await fixture();
  const resources = new BackgroundBuildRetryResources({ storage: { load: async () => [], save: async () => { throw new Error('No original journal writes'); } },
    privateDirectory: join(f.root, 'clean-worker'), vaultDirectory: join(f.root, 'vault'), protectedVaultFolders: () => [], assertReady: async () => {} });
  const source: BackgroundBuildRetrySource = { ...f.source, sourceKind: 'repository', sourceWorkspaceId: undefined, sourceJobId: undefined, sourceAttemptId: undefined, expectedIncrement: undefined };
  const inspection = await resources.inspect(source); expect(inspection).toMatchObject({ sourceKind: 'repository', fileCount: 0, increment: null, humanCessationRequired: false });
  await agentGit(f.project, ['checkout', '--detach', 'HEAD']);
  await expect(resources.inspect({ ...source, runId: 'detached-run' })).resolves.toMatchObject({ sourceKind: 'repository', fileCount: 0, baseCommit: inspection.baseCommit });
  await expect(f.resources.inspect(source)).rejects.toThrow();
  await expect(resources.inspect({ ...source, expectedIncrement: f.source.expectedIncrement })).rejects.toThrow();
  await writeFile(join(f.project, 'game.ts'), 'uncommitted user changes'); await expect(resources.inspect(source)).rejects.toThrow('clean');
}, 90000);
