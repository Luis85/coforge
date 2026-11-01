import { afterEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { protectedWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspace-protection';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture(git: boolean) {
  await mkdir('.nq', { recursive: true }); const root = await realpath(await mkdtemp(join(process.cwd(), '.nq/workspace-protection-'))); roots.push(root);
  const project = join(root, 'src'); const vault = join(project, 'vault');
  await mkdir(join(vault, 'Private'), { recursive: true }); await mkdir(join(vault, 'Later'));
  if (git) execFileSync('git', ['-c', 'init.templateDir=', 'init', '-q', root], { windowsHide: true });
  else await writeFile(join(root, '.git'), 'not a Git repository');
  const lease = { cwd: project, capture: async () => undefined, release: async () => {} };
  const base: WorkflowWorkspaces = { start: async () => {}, acquire: async () => lease, acknowledge: async () => {}, assertReviewable: async () => {} };
  const folders = ['Private']; const scope = protectedWorkflowWorkspaces(base, () => vault, () => folders);
  const request = { runId: 'run', projectId: 'project', attemptId: 'attempt', access: 'readproject' as const, integration: { ...defaultIntegration(), projectPath: project } };
  return { root, project, vault, folders, scope, request };
}
it('maps Git-root private folders into a nested read-only lease and refreshes new restrictions', async () => {
  const f = await fixture(true); const lease = await f.scope.acquire(f.request);
  expect(lease.readOnly).toBe(true);
  expect(lease.protectedProjectPaths).toContain('vault/Private');
  expect(lease.protectedProjectPaths).not.toContain('src/vault/Private');
  f.folders.push('Later'); await lease.validate?.();
  expect(lease.protectedProjectPaths).toContain('vault/Later');
});
it('keeps non-Git read-only projects usable without losing their managed-folder boundary', async () => {
  const f = await fixture(false); const lease = await f.scope.acquire(f.request);
  expect(lease.readOnly).toBe(true); expect(lease.protectedProjectPaths).toContain('vault/Private');
  await lease.validate?.();
});
it('refuses a configured read root contained in a managed private folder', async () => {
  const f = await fixture(true); f.folders.push(f.project);
  await expect(f.scope.acquire(f.request)).rejects.toThrow();
});
