import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { expect, it, vi } from 'vitest';
import { readNativeProcessIdentity, sameNativeProcessIdentity, stopOwnedProcessTree, type NativeProcessIdentity } from '../../../infrastructure/coforge/durable-worker/process-identity';

it('observes an OS birth identity and terminates only the controlled original process tree', async () => {
  const child = spawn(process.execPath, ['-e', "process.stdout.write('ready');setInterval(()=>{},1000)"], { detached: true, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  const closed = once(child, 'close');
  try {
    await once(child.stdout!, 'data');
    if (!child.pid) throw new Error('Missing controlled child');
    const identity = await readNativeProcessIdentity(child.pid);
    if (!identity) throw new Error('Controlled process has no identity');
    expect(identity.birth.length).toBeGreaterThan(0);
    expect(identity.image).toMatch(/^[a-f0-9]{64}$/u);
    expect(sameNativeProcessIdentity(identity, (await readNativeProcessIdentity(child.pid))!)).toBe(true);
    const proof = await stopOwnedProcessTree(identity);
    const afterProof = await readNativeProcessIdentity(child.pid);
    expect(proof, JSON.stringify({ proof, exit: child.exitCode, signal: child.signalCode, stillOriginal: afterProof && sameNativeProcessIdentity(identity, afterProof) })).toMatchObject({ state: 'terminated', treeConfirmed: true });
    await closed;
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await closed; }
}, 20000);

it('does not signal a reused PID or claim its unrelated process was terminated', async () => {
  const original: NativeProcessIdentity = { pid: 987654, platform: process.platform, birth: 'old-birth', image: 'a'.repeat(64) };
  const terminate = vi.fn(async () => true);
  const proof = await stopOwnedProcessTree(original, { read: async () => ({ ...original, birth: 'new-birth' }), terminate });
  expect(proof).toMatchObject({ state: 'different', treeConfirmed: false });
  expect(terminate).not.toHaveBeenCalled();
});

it('keeps changed images and absent roots unverified as process-tree outcomes', async () => {
  const original: NativeProcessIdentity = { pid: 987654, platform: process.platform, birth: 'known-birth', image: 'a'.repeat(64) };
  const terminate = vi.fn(async () => true);
  expect(await stopOwnedProcessTree(original, { read: async () => ({ ...original, image: 'b'.repeat(64) }), terminate }))
    .toMatchObject({ state: 'unverified', treeConfirmed: false });
  expect(await stopOwnedProcessTree(original, { read: async () => undefined, terminate }))
    .toMatchObject({ state: 'absent', treeConfirmed: false });
  expect(await stopOwnedProcessTree(original, { read: async () => { throw new Error('Access unavailable'); }, terminate }))
    .toMatchObject({ state: 'unverified', treeConfirmed: false });
  expect(terminate).not.toHaveBeenCalled();
});
