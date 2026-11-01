import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerService, type WorkerHooks } from '../../../infrastructure/coforge/durable-worker/service';
import { durableRequest } from './durable-worker-fixture';
import { retainedJob } from '../../../infrastructure/coforge/durable-worker/recovery';

const folders: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
async function store() {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-sessions-')); folders.push(directory);
  const store = new WorkerStore(new WorkerFiles(directory), 'worker-one'); await store.initialize(); return store;
}

it('retains bounded native session observations through worker completion and journal reload without changing the provider result', async () => {
  const journal = await store();
  const execute = vi.fn(async (_request, hooks: WorkerHooks) => {
    await hooks.sessionEvent?.({ kind: 'session', sessionId: 'root', label: 'Native root', status: 'running' });
    for (let index = 0; index < 140; index++) await hooks.sessionEvent?.({ kind: 'message', sessionId: 'child', parentSessionId: 'root', text: `Observation ${index}` });
    return { summary: 'Original result', costUsd: 0.25 };
  });
  const service = new WorkerService(journal, execute); const ref = await service.prepare(durableRequest()); await service.start(ref); await service.settle();
  const completed = service.inspect(ref);
  expect(completed.phase).toBe('completed'); expect(completed.result).toEqual({ summary: 'Original result', costUsd: 0.25 });
  expect(completed.sessionTrace?.events).toHaveLength(128); expect(completed.sessionTrace?.truncated).toBe(true);
  expect(completed.sessionTrace?.events.at(-1)?.text).toBe('Observation 139');
  const reloaded = new WorkerStore(new WorkerFiles(journal.files.directory), 'worker-one'); await reloaded.initialize();
  expect(reloaded.get(ref).record.snapshot.sessionTrace).toEqual(completed.sessionTrace); expect(execute).toHaveBeenCalledOnce();
});

it('isolates a cosmetic session journal write failure from provider completion and authoritative cost persistence', async () => {
  const journal = await store(); let context: WorkerHooks | undefined; let proceed: (() => void) | undefined;
  const execute = vi.fn(async (_request, hooks: WorkerHooks) => {
    context = hooks; await new Promise<void>(resolve => { proceed = resolve; });
    await hooks.sessionEvent?.({ kind: 'session', sessionId: 'root', status: 'running' });
    await hooks.cost(0.5); return { summary: 'Complete' };
  });
  const service = new WorkerService(journal, execute); const ref = await service.prepare(durableRequest()); await service.start(ref);
  await vi.waitFor(() => expect(context).toBeDefined()); expect(context?.sessionEvent).toBeTypeOf('function');
  const files = journal.get(ref).files; const write = files.write.bind(files); const read = files.read.bind(files); let failed = false;
  const failures: Array<{ operation: string; file: string; code: string; syscall?: string }> = [];
  const noteFailure = (operation: string, file: string, cause: unknown) => {
    const code = cause instanceof Error && 'code' in cause && typeof cause.code === 'string' ? cause.code : 'identity-or-data-check';
    const syscall = cause instanceof Error && 'syscall' in cause && typeof cause.syscall === 'string' ? cause.syscall : undefined;
    failures.push({ operation, file, code, ...(syscall ? { syscall } : {}) });
  };
  vi.spyOn(files, 'read').mockImplementation(async (name, maxBytes) => {
    try { return await read(name, maxBytes); } catch (cause) { noteFailure('read', name, cause); throw cause; }
  });
  vi.spyOn(files, 'write').mockImplementation(async (name, value) => {
    if (name === 'session-trace.json') { failed = true; throw new Error('Synthetic observer storage failure'); }
    try { await write(name, value); } catch (cause) { noteFailure('write', name, cause); throw cause; }
  });
  proceed!(); await service.settle();
  expect(failures).toEqual([]);
  expect(service.inspect(ref)).toMatchObject({ phase: 'completed', costUsd: 0.5, result: { summary: 'Complete' } });
  expect(execute).toHaveBeenCalledOnce(); expect(service.inspect(ref).sessionTrace).toBeUndefined();
  expect(failed).toBe(true);
});

it('keeps live observations outside the control journal and does not invalidate terminal acknowledgement or capacity', async () => {
  const journal = await store(); const execute = vi.fn(async () => ({ summary: 'Original result', costUsd: 0.25 }));
  const service = new WorkerService(journal, execute); const ref = await service.prepare(durableRequest()); await service.start(ref); await service.settle();
  const terminal = service.inspect(ref); await service.acknowledge(ref, terminal.sequence);
  const before = await journal.get(ref).files.read('record.json');
  await journal.observeSession(ref, { kind: 'message', sessionId: 'root', text: 'Late display observation' });
  const observed = service.inspect(ref);
  expect(observed.sequence).toBe(terminal.sequence); expect(observed.phase).toBe('completed'); expect(observed.result).toEqual(terminal.result);
  expect(observed.sessionTrace?.events.at(-1)?.text).toBe('Late display observation');
  expect(await journal.get(ref).files.read('record.json')).toEqual(before);
  expect(journal.get(ref).record.acknowledgedSequence).toBe(observed.sequence);
  const next = durableRequest(); next.jobId = next.input.jobId = 'next-session-job'; next.runId = next.input.workflow.runId = 'next-session-run';
  await expect(service.prepare(next)).resolves.toMatchObject({ workerId: 'worker-one' }); expect(execute).toHaveBeenCalledOnce();
  const reloaded = new WorkerStore(new WorkerFiles(journal.files.directory), 'worker-one'); await reloaded.initialize();
  expect(reloaded.get(ref).record.snapshot.sessionTrace).toEqual(observed.sessionTrace);
  expect((await retainedJob(new WorkerFiles(journal.files.directory), ref)).record.snapshot.sessionTrace).toEqual(observed.sessionTrace);
});

it.each(['corrupt', 'foreign'] as const)('ignores a %s observation file while retaining the original result and cost', async mode => {
  const journal = await store(); const service = new WorkerService(journal, async () => ({ summary: 'Complete', costUsd: 0.5 }));
  const ref = await service.prepare(durableRequest()); await service.start(ref); await service.settle();
  await journal.observeSession(ref, { kind: 'session', sessionId: 'root', status: 'completed' });
  const trace = service.inspect(ref).sessionTrace;
  await journal.get(ref).files.write('session-trace.json', mode === 'corrupt' ? { invalid: true }
    : { version: 1, ref: { ...ref, inputHash: 'f'.repeat(64) }, trace });
  const reloaded = new WorkerStore(new WorkerFiles(journal.files.directory), 'worker-one'); await reloaded.initialize();
  expect(reloaded.get(ref).record.snapshot).toMatchObject({ phase: 'completed', result: { summary: 'Complete', costUsd: 0.5 } });
  expect(reloaded.get(ref).record.snapshot.sessionTrace).toBeUndefined();
});

it('still quarantines an authoritative journal failure before launching a provider', async () => {
  const journal = await store(); const execute = vi.fn(async () => ({ summary: 'Must not run' })); const service = new WorkerService(journal, execute);
  const ref = await service.prepare(durableRequest());
  vi.spyOn(journal.get(ref).files, 'write').mockRejectedValueOnce(new Error('Authoritative storage unavailable'));
  await expect(service.start(ref)).rejects.toThrow('journal could not commit'); expect(execute).not.toHaveBeenCalled();
  expect(() => service.inspect(ref)).toThrow('journal is unavailable');
});

it('retains valid legacy embedded observations when an optional sidecar cannot be read', async () => {
  const journal = await store(); const service = new WorkerService(journal, async (_request, hooks) => {
    await hooks.sessionEvent?.({ kind: 'message', sessionId: 'legacy', text: 'Previously retained display evidence' });
    return { summary: 'Complete' };
  });
  const ref = await service.prepare(durableRequest()); await service.start(ref); await service.settle();
  const expected = service.inspect(ref).sessionTrace;
  await journal.get(ref).files.write('session-trace.json', { invalid: true });
  const reloaded = new WorkerStore(new WorkerFiles(journal.files.directory), 'worker-one'); await reloaded.initialize();
  expect(reloaded.get(ref).record.snapshot.sessionTrace).toEqual(expected);
  expect(reloaded.get(ref).record.snapshot.phase).toBe('completed');
});
