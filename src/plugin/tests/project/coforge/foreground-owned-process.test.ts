import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
const proof = vi.hoisted(() => ({ read: vi.fn(), stop: vi.fn() }));
vi.mock('../../../infrastructure/coforge/durable-worker/process-identity', () => ({ readNativeProcessIdentity: proof.read, stopOwnedProcessTree: proof.stop }));
import { captureProcess, ProcessOwnershipUnknown, type ProcessOptions } from '../../../infrastructure/coforge/process';

afterEach(() => { proof.read.mockReset(); proof.stop.mockReset(); });
it.each([false, true])('awaits original identity/group proof for cancellation (managed compatibility: %s)', async managed => {
  const controller = new AbortController(); let terminationPersisted = false;
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  proof.stop.mockImplementation(async (identity: { pid: number }) => {
    process.kill(identity.pid); await new Promise(resolve => setTimeout(resolve, 30)); terminationPersisted = true;
    return { state: 'terminated', treeConfirmed: true, observedAt: new Date().toISOString() };
  });
  const run = captureProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: tmpdir(), signal: controller.signal,
    ...(managed ? { managedSession: true, input: '' } : { ownedTree: true }) });
  await vi.waitFor(() => expect(proof.read).toHaveBeenCalledOnce()); controller.abort();
  await expect(run).rejects.toThrow('cancelled');
  expect(proof.stop).toHaveBeenCalledOnce(); expect(terminationPersisted).toBe(true);
});
it.each([false, true])('holds unknown ownership after cancellation instead of accepting a result (managed compatibility: %s)', async managed => {
  const controller = new AbortController();
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  proof.stop.mockImplementation(async (identity: { pid: number }) => {
    process.kill(identity.pid); return { state: 'unverified', treeConfirmed: false, observedAt: new Date().toISOString() };
  });
  const run = captureProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: tmpdir(), signal: controller.signal,
    ...(managed ? { managedSession: true, input: '' } : { ownedTree: true }) });
  await vi.waitFor(() => expect(proof.read).toHaveBeenCalledOnce()); controller.abort();
  await expect(run).rejects.toMatchObject({ name: 'ProcessOwnershipUnknown' });
});
it.each([false, true])('does not deliver task input before original identity (managed compatibility: %s)', async managed => {
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  let release: (() => void) | undefined; let settled = false;
  const committed = new Promise<void>(resolve => { release = resolve; });
  if (managed) proof.read.mockImplementation(async (pid: number) => { await committed; return { pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }; });
  const onOwnedProcess = vi.fn<NonNullable<ProcessOptions['onOwnedProcess']>>(async () => { if (!managed) await committed; });
  const run = captureProcess(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { cwd: tmpdir(), input: 'authorized task',
    ...(managed ? { managedSession: true } : { ownedTree: true }), onOwnedProcess });
  void run.finally(() => { settled = true; });
  await vi.waitFor(() => expect(managed ? proof.read : onOwnedProcess).toHaveBeenCalledOnce());
  expect(settled).toBe(false); release!();
  expect(await run).toBe('authorized task');
  if (managed) expect(onOwnedProcess).not.toHaveBeenCalled(); else expect(onOwnedProcess.mock.calls[0]?.[1]).toBe('launched');
});
it('retains bounded redacted nonzero diagnostics privately without changing the quarantine message', async () => {
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  let error: unknown;
  try { await captureProcess(process.execPath, ['-e', 'process.stderr.write("fixture transport diagnostic Bearer private-token");process.exit(2)'], { cwd: tmpdir(), ownedTree: true }); }
  catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(ProcessOwnershipUnknown);
  if (!(error instanceof ProcessOwnershipUnknown)) throw new Error('Expected original process ownership uncertainty.');
  expect(error.diagnostic).toContain('fixture transport diagnostic');
  expect(error.diagnostic).not.toContain('private-token');
  expect(error.message).not.toContain('fixture transport diagnostic');
  expect(Object.keys(error)).not.toContain('diagnostic');
});

it('clears transport settlement at actual root close before slow ownership persistence finishes', async () => {
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  const onOwnedProcess = vi.fn<NonNullable<ProcessOptions['onOwnedProcess']>>(async (_identity, phase) => {
    if (phase === 'launched') await new Promise(resolve => setTimeout(resolve, 2200));
  });
  expect(await captureProcess(process.execPath, ['-e', 'process.stdout.write("closed root result")'], {
    cwd: tmpdir(), input: '', ownedTree: true, managedSession: true, onOwnedProcess,
  })).toBe('closed root result');
  expect(proof.stop).not.toHaveBeenCalled();
});

it('awaits the current unknown-stop proof when cancellation arrives after root close during ownership persistence', async () => {
  const controller = new AbortController(); let output = false, stopFinished = false;
  let commit: (() => void) | undefined; const committed = new Promise<void>(resolve => { commit = resolve; });
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  proof.stop.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 30)); stopFinished = true; return { treeConfirmed: false }; });
  const onOwnedProcess = vi.fn<NonNullable<ProcessOptions['onOwnedProcess']>>(async (_identity, phase) => { if (phase === 'launched') await committed; });
  const run = captureProcess(process.execPath, ['-e', 'process.stdout.write("closed root result")'], {
    cwd: tmpdir(), input: '', ownedTree: true, managedSession: true, signal: controller.signal, onOwnedProcess, onStdout: () => { output = true; },
  });
  await vi.waitFor(() => expect(output).toBe(true)); await new Promise(resolve => setTimeout(resolve, 100));
  controller.abort(); commit!();
  await expect(run).rejects.toBeInstanceOf(ProcessOwnershipUnknown);
  expect(stopFinished).toBe(true); expect(onOwnedProcess).toHaveBeenCalledWith(expect.anything(), 'unknown');
});
