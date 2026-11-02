import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { snapshotTree } from '../../../infrastructure/coforge/background-build-seed/tree';

vi.mock('../../../infrastructure/coforge/agent-worktree', () => ({ agentGit: vi.fn() }));
const roots: string[] = [];
afterEach(async () => { vi.resetAllMocks(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'index-query-'))); roots.push(root);
  const body = 'original bytes\n'; await writeFile(join(root, 'game.ts'), body);
  const hash = createHash('sha1').update('blob ' + Buffer.byteLength(body) + '\0' + body).digest('hex');
  let flag = 'H'; let stage = 0;
  vi.mocked(agentGit).mockImplementation(async (_cwd, args) => {
    if (args[0] === 'ls-tree') return `100644 blob ${hash}\tgame.ts\0`;
    if (args[0] === 'ls-files' && args.includes('--stage')) return `${args.includes('-v') ? flag + ' ' : ''}100644 ${hash} ${stage}\tgame.ts\0`;
    if (args[0] === 'ls-files') return `${flag} game.ts\0`;
    return '';
  });
  return { root, hide: (value: string) => { flag = value; }, conflict: () => { stage = 1; } };
}

it('observes modes and hidden flags together while continuing to hash fresh file bytes', async () => {
  const f = await fixture(); const first = await snapshotTree(f.root, 'a'.repeat(40));
  expect(vi.mocked(agentGit).mock.calls.filter(([, args]) => args[0] === 'ls-files')).toHaveLength(1);
  await writeFile(join(f.root, 'game.ts'), 'later bytes\n');
  const second = await snapshotTree(f.root, 'a'.repeat(40));
  expect(second.treeHash).not.toBe(first.treeHash);
  expect(second.files[0]?.hash).not.toBe(first.files[0]?.hash);
});

it.each(['S', 'h'])('rejects hidden index flag %s on a later snapshot', async flag => {
  const f = await fixture(); await snapshotTree(f.root, 'a'.repeat(40));
  f.hide(flag);
  await expect(snapshotTree(f.root, 'a'.repeat(40))).rejects.toThrow('hidden Git index flags');
});

it('continues to reject an unresolved index stage', async () => {
  const f = await fixture(); f.conflict();
  await expect(snapshotTree(f.root, 'a'.repeat(40))).rejects.toThrow();
});
