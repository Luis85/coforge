import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerService, type WorkerHooks } from '../../../infrastructure/coforge/durable-worker/service';
import { durableRequest } from './durable-worker-fixture';

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
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
  vi.spyOn(journal.get(ref).files, 'write').mockRejectedValueOnce(new Error('Synthetic observer storage failure'));
  proceed!(); await service.settle();
  expect(service.inspect(ref)).toMatchObject({ phase: 'completed', costUsd: 0.5, result: { summary: 'Complete' } });
  expect(execute).toHaveBeenCalledOnce(); expect(service.inspect(ref).sessionTrace).toBeUndefined();
});
