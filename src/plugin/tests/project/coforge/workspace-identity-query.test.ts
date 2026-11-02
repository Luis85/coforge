import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { WorkflowWorkspaceRecord } from '../../../features/coforge/application/workflow-workspace-ports';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { verifyRetainedWorkspace } from '../../../infrastructure/coforge/durable-worker/workspace-proof';
import { LocalWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspaces';

vi.mock('../../../infrastructure/coforge/agent-worktree', () => ({ agentGit: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'identity-query-'))); roots.push(root);
  const cwd = join(root, 'tree'); const common = join(root, 'repository');
  await mkdir(cwd); await mkdir(common);
  const pointer = `gitdir: ${common}\n`; await writeFile(join(cwd, '.git'), pointer);
  const info = await stat(cwd);
  const record: WorkflowWorkspaceRecord = { id: 'bg-proof', runId: 'run', projectId: 'project', projectPath: common, cwd, branch: 'coforge/proof',
    baseCommit: 'a'.repeat(40), phase: 'ready', pointer, directoryDevice: info.dev, directoryInode: info.ino };
  let head = record.baseCommit;
  vi.mocked(agentGit).mockImplementation(async (_cwd, args) => {
    if (args.includes('--show-toplevel')) return `${cwd}\n${common}\n${head}\nrefs/heads/${record.branch}\n`;
    return args[0] === 'symbolic-ref' ? record.branch : head;
  });
  return { record, changeHead: () => { head = 'b'.repeat(40); } };
}

it('checks retained Git identity in one fresh query and rejects a later commit change', async () => {
  const f = await fixture();
  await verifyRetainedWorkspace(f.record);
  expect(agentGit).toHaveBeenCalledTimes(1);
  f.changeHead();
  await expect(verifyRetainedWorkspace(f.record)).rejects.toThrow('identity changed');
  expect(agentGit).toHaveBeenCalledTimes(2);
});

it('still checks the original pointer bytes before every identity query', async () => {
  const f = await fixture(); await verifyRetainedWorkspace(f.record);
  vi.mocked(agentGit).mockClear();
  await writeFile(join(f.record.cwd, '.git'), (await readFile(join(f.record.cwd, '.git'), 'utf8')) + 'replaced');
  await expect(verifyRetainedWorkspace(f.record)).rejects.toThrow('identity changed');
  expect(agentGit).not.toHaveBeenCalled();
});

it('uses the same fresh identity proof for a foreground review without redundant Git launches', async () => {
  const f = await fixture();
  const workspaces = new LocalWorkflowWorkspaces({ load: async () => [f.record], save: async () => {} });
  await workspaces.start(); await workspaces.assertReviewable(f.record.id);
  expect(agentGit).toHaveBeenCalledTimes(1);
  f.changeHead();
  await expect(workspaces.assertReviewable(f.record.id)).rejects.toThrow('needs attention');
  expect(agentGit).toHaveBeenCalledTimes(2);
});
