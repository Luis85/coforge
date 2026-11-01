import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
const proof = vi.hoisted(() => ({ read: vi.fn(), stop: vi.fn() }));
vi.mock('../../../infrastructure/coforge/durable-worker/process-identity', () => ({ readNativeProcessIdentity: proof.read, stopOwnedProcessTree: proof.stop }));
import { captureProcess, ProcessOwnershipUnknown, type ProcessOptions } from '../../../infrastructure/coforge/process';

afterEach(() => { proof.read.mockReset(); proof.stop.mockReset(); });
it('awaits owned tree termination before releasing a cancelled delegated foreground invocation', async () => {
  const controller = new AbortController(); let terminationPersisted = false;
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  proof.stop.mockImplementation(async (identity: { pid: number }) => {
    process.kill(identity.pid); await new Promise(resolve => setTimeout(resolve, 30)); terminationPersisted = true;
    return { state: 'terminated', treeConfirmed: true, observedAt: new Date().toISOString() };
  });
  const run = captureProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: tmpdir(), signal: controller.signal, ownedTree: true });
  await vi.waitFor(() => expect(proof.read).toHaveBeenCalledOnce()); controller.abort();
  await expect(run).rejects.toThrow('cancelled');
  expect(proof.stop).toHaveBeenCalledOnce(); expect(terminationPersisted).toBe(true);
});
it('distinguishes unknown ownership from an ordinary retryable cancellation', async () => {
  const controller = new AbortController();
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  proof.stop.mockImplementation(async (identity: { pid: number }) => {
    process.kill(identity.pid); return { state: 'unverified', treeConfirmed: false, observedAt: new Date().toISOString() };
  });
  const run = captureProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: tmpdir(), signal: controller.signal, ownedTree: true });
  await vi.waitFor(() => expect(proof.read).toHaveBeenCalledOnce()); controller.abort();
  await expect(run).rejects.toMatchObject({ name: 'ProcessOwnershipUnknown' });
});
it('does not deliver task input until original process identity has committed', async () => {
  proof.read.mockImplementation(async (pid: number) => ({ pid, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }));
  let release: (() => void) | undefined; let settled = false;
  const committed = new Promise<void>(resolve => { release = resolve; });
  const onOwnedProcess = vi.fn<NonNullable<ProcessOptions['onOwnedProcess']>>(async () => { await committed; });
  const run = captureProcess(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { cwd: tmpdir(), input: 'authorized task', ownedTree: true, onOwnedProcess });
  void run.finally(() => { settled = true; });
  await vi.waitFor(() => expect(onOwnedProcess).toHaveBeenCalledOnce());
  expect(settled).toBe(false); release!();
  expect(await run).toBe('authorized task');
  expect(onOwnedProcess.mock.calls[0]?.[1]).toBe('launched');
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
