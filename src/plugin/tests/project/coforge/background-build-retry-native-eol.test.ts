import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { retrySourceFixture } from './background-build-retry-native-fixture';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import { BackgroundBuildRetryResources } from '../../../infrastructure/coforge/background-build-retry-resources';
const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
it('does not mistake checkout CRLF for edits to unchanged protected files', async () => {
  const f = await retrySourceFixture(folders); await agentGit(f.project, ['config', 'core.autocrlf', 'true']);
  await mkdir(join(f.project, 'Managed')); await writeFile(join(f.project, 'Managed', 'request.md'), 'Private managed note\n');
  await agentGit(f.project, ['add', 'Managed/request.md']); await agentGit(f.project, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Managed tracked fixture']);
  const lease = await f.workspaces.acquire({ runId: 'crlf-run', projectId: f.source.projectId, attemptId: 'crlf-attempt', access: 'editworktree',
    integration: { ...defaultIntegration(), projectPath: f.project, worktreeFolder: join(f.root, 'crlf-worktrees'), allowImplementation: true } });
  expect(await readFile(join(lease.cwd, 'Managed', 'request.md'), 'utf8')).toContain('\r\n');
  await writeFile(join(lease.cwd, 'game.ts'), 'Reviewed change\r\n'); await lease.release();
  const source = { ...f.source, runId: 'crlf-run', sourceJobId: 'crlf-job', sourceAttemptId: 'crlf-attempt', sourceWorkspaceId: lease.id, expectedIncrement: undefined };
  const resources = new BackgroundBuildRetryResources({ storage: f.storage, privateDirectory: join(f.root, 'crlf-worker'), vaultDirectory: f.vault,
    protectedVaultFolders: () => [join(f.project, 'Managed')], assertReady: async () => {} });
  const inspected = await resources.inspect(source); expect(inspected.fileCount).toBe(1); expect(inspected.increment?.files.map(file => file.path)).toEqual(['game.ts']);
  await agentGit(lease.cwd, ['update-index', '--assume-unchanged', '--', 'game.ts']);
  await expect(resources.inspect(source)).rejects.toThrow('hidden Git index flags');
}, 45000);
