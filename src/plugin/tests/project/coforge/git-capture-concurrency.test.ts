import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { afterEach, expect, it, vi } from 'vitest';
const { capture } = vi.hoisted(() => ({ capture: vi.fn<(_executable: string, args: readonly string[]) => Promise<string>>() }));
vi.mock('../../../infrastructure/coforge/process', () => ({ captureProcess: capture }));
import { captureIncrement } from '../../../infrastructure/coforge/agent-worktree';

const roots: string[] = [];
afterEach(async () => { capture.mockReset(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'capture-pair-'))); roots.push(root);
  let stats: (value: string) => void = () => {}; let patch: (value: string) => void = () => {}; let rejectStats: (error: Error) => void = () => {};
  const statsRead = new Promise<string>((resolve, reject) => { stats = resolve; rejectStats = reject; });
  const patchRead = new Promise<string>(resolve => { patch = resolve; });
  capture.mockImplementation(async (_executable, args) => args.includes('--numstat') ? statsRead : args.includes('diff') ? patchRead : '');
  return { root, stats, patch, rejectStats };
}

it('starts both bounded diff readers and waits for both before returning captured evidence', async () => {
  const f = await fixture(); let settled = false;
  const reading = captureIncrement(f.root, 'branch', 'Snapshot').finally(() => { settled = true; });
  try {
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    f.stats('1\t0\tgame.ts\n'); await nextTurn();
    expect(settled).toBe(false);
    f.patch('diff --git a/game.ts b/game.ts\n+changed\n');
    expect(await reading).toMatchObject({ files: [{ path: 'game.ts', additions: 1, deletions: 0 }], diff: expect.stringContaining('+changed') });
  } finally { f.stats('1\t0\tgame.ts\n'); f.patch('+changed'); await reading.catch(() => undefined); }
});

it('settles the other launched reader before propagating a capture failure', async () => {
  const f = await fixture(); let settled = false;
  const reading = captureIncrement(f.root, 'branch', 'Snapshot').then(() => undefined, (error: unknown) => { settled = true; return error; });
  try {
    await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    f.rejectStats(new Error('Controlled read failure')); await nextTurn();
    expect(settled).toBe(false);
    f.patch('diff'); expect(await reading).toMatchObject({ message: 'Controlled read failure' });
  } finally { f.stats(''); f.patch(''); await reading; }
});
