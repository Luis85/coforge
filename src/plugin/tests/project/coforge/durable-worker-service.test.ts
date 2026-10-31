import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerOwnershipUnknown, WorkerService, type WorkerHooks } from '../../../infrastructure/coforge/durable-worker/service';
import { durableRequest } from './durable-worker-fixture';
const folders: string[] = [];
afterEach(async () => { for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true }); });
async function store(now = () => Date.now()) {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-service-')); folders.push(directory);
  const store = new WorkerStore(new WorkerFiles(directory), 'worker-one', 1, now); await store.initialize(); return store;
}
it('prepares and starts idempotently, survives 101 quiet hours without a deadline and applies advisory idle warnings only', async () => {
  let now = Date.now(); const journal = await store(() => now);
  let finish: (() => void) | undefined; let hooks: WorkerHooks | undefined;
  const execute = vi.fn(async (_request, context: WorkerHooks) => { hooks = context; await new Promise<void>(resolve => { finish = resolve; }); return { summary: 'Complete' }; });
  const service = new WorkerService(journal, execute); const request = durableRequest();
  const ref = await service.prepare(request); expect(execute).not.toHaveBeenCalled();
  expect(await service.prepare(request)).toEqual(ref);
  await service.start(ref); await service.start(ref); await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  now += 101 * 3600 * 1000; await service.tick();
  expect(hooks?.signal.aborted).toBe(false); expect(service.inspect(ref).elapsedSeconds).toBe(101 * 3600);
  expect(service.inspect(ref).logs.join(' ')).toContain('advisory');
  finish!(); await service.settle();
  const complete = service.inspect(ref); expect(complete.phase).toBe('completed');
  await service.acknowledge(ref, complete.sequence); await service.acknowledge(ref, complete.sequence);
  expect(execute).toHaveBeenCalledTimes(1);
  const reused = structuredClone(request); reused.runId = reused.input.workflow.runId = 'reused-job-run'; reused.attemptId = reused.input.workflow.attemptId = 'reused-job-attempt';
  await expect(service.prepare(reused)).rejects.toThrow('job identity');
  await expect(service.prepare({ ...request, policy: { ...request.policy, maxRuntimeSeconds: 1 } })).rejects.toThrow();
});
it('persists cancellation before completion, preserves ownership uncertainty and never acknowledges or relaunches it', async () => {
  const journal = await store(); const execute = vi.fn(async (_request, hooks: WorkerHooks) => {
    await new Promise<void>((_resolve, reject) => hooks.signal.addEventListener('abort', () => reject(new WorkerOwnershipUnknown('unknown')), { once: true }));
    return {};
  });
  const service = new WorkerService(journal, execute); const ref = await service.prepare(durableRequest()); await service.start(ref);
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  expect((await service.cancel(ref)).cancellationRequested).toBe(true); await service.settle();
  expect(service.inspect(ref).phase).toBe('attention');
  await expect(service.acknowledge(ref, service.inspect(ref).sequence)).rejects.toThrow();
  await service.start(ref); expect(execute).toHaveBeenCalledTimes(1);
});
it('runs two admitted Builds, blocks a third, and lowers capacity without killing active work', async () => {
  const journal = await store(); const hooks: WorkerHooks[] = []; const finish: Array<() => void> = [];
  const execute = vi.fn(async (_request, context: WorkerHooks) => { hooks.push(context); await new Promise<void>(resolve => finish.push(resolve)); return { summary: 'Complete' }; });
  const service = new WorkerService(journal, execute); await service.configureConcurrency(2);
  const first = durableRequest();
  const second = structuredClone(first); second.jobId = second.input.jobId = 'job-two'; second.runId = second.input.workflow.runId = 'run-two'; second.attemptId = second.input.workflow.attemptId = 'attempt-two'; second.ideaId = second.input.idea.id = 'CF-902'; second.input.idea.number = 902;
  const third = structuredClone(second); third.jobId = third.input.jobId = 'job-three'; third.runId = third.input.workflow.runId = 'run-three'; third.attemptId = third.input.workflow.attemptId = 'attempt-three'; third.ideaId = third.input.idea.id = 'CF-903'; third.input.idea.number = 903;
  const a = await service.prepare(first); const b = await service.prepare(second);
  await service.start(a); await service.start(b); await service.start(a);
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  await expect(service.prepare(third)).rejects.toThrow(/capacity|Build/i);
  await service.configureConcurrency(1); expect(hooks.every(item => !item.signal.aborted)).toBe(true);
  finish.forEach(done => done()); await service.settle();
  await service.acknowledge(a, service.inspect(a).sequence); await service.acknowledge(b, service.inspect(b).sequence);
  expect((await service.prepare(third)).executionId).not.toBe(a.executionId);
});
it('releases only an explicitly cancelled unstarted reservation without a canonical acknowledgement', async () => {
  const journal = await store(); const execute = vi.fn(async () => ({ summary: 'Must not run' })); const service = new WorkerService(journal, execute);
  const request = durableRequest(); const ref = await service.prepare(request);
  const cancelled = await service.cancel(ref); expect(cancelled.phase).toBe('cancelled'); expect(journal.get(ref).record.reservationReleased).toBe(true);
  expect(journal.get(ref).record.acknowledgedSequence).toBeUndefined();
  await expect(service.start(ref)).rejects.toThrow('can never start'); expect(execute).not.toHaveBeenCalled();
  const next = structuredClone(request); next.jobId = next.input.jobId = 'replacement'; next.attemptId = next.input.workflow.attemptId = 'replacement-attempt';
  expect((await service.prepare(next)).executionId).not.toBe(ref.executionId);
});
it('coalesces hot activity and polling over 101 hours without journal or sequence amplification, then durably captures cost', async () => {
  let now = Date.now(); const journal = await store(() => now); let hooks: WorkerHooks | undefined; let finish: (() => void) | undefined;
  const service = new WorkerService(journal, async (_request, context) => { hooks = context; await new Promise<void>(resolve => { finish = resolve; }); return { summary: 'Done' }; });
  const ref = await service.prepare(durableRequest()); await service.start(ref); await vi.waitFor(() => expect(hooks).toBeDefined());
  const sequence = journal.get(ref).record.snapshot.sequence; const writes = vi.spyOn(journal.get(ref).files, 'write');
  for (let n = 0; n < 1000; n++) { await hooks!.activity(); await hooks!.log('Observed provider activity ' + n); service.inspect(ref); }
  now += 101 * 3600 * 1000; await service.tick();
  expect(service.inspect(ref).sequence).toBe(sequence); expect(service.inspect(ref).logs.length).toBeLessThanOrEqual(50);
  expect(writes.mock.calls.map(call => call[0])).toEqual(['hot.json']);
  await hooks!.cost(0.75); expect(journal.get(ref).record.snapshot.costUsd).toBe(0.75);
  finish!(); await service.settle(); expect(service.inspect(ref)).toMatchObject({ phase: 'completed', costUsd: 0.75, elapsedSeconds: 101 * 3600 });
});
it('cancels a late unpaid preparation by job identity and never admits the same lost intent again', async () => {
  const journal = await store(); const execute = vi.fn(async () => ({})); const service = new WorkerService(journal, execute);
  const request = durableRequest(); await service.cancelUnstarted(request.jobId);
  await expect(service.prepare(request)).rejects.toThrow('cancelled before admission');
  const next = structuredClone(request); next.jobId = next.input.jobId = 'independent'; const ref = await service.prepare(next);
  await service.cancelUnstarted(next.jobId); await expect(service.start(ref)).rejects.toThrow('can never start');
  expect(journal.get(ref).record.acknowledgedSequence).toBeUndefined(); expect(execute).not.toHaveBeenCalled();
});
it('keeps feature ownership exclusive across restored host run identities', async () => {
  const journal = await store(); const service = new WorkerService(journal, async () => ({})); await service.configureConcurrency(2);
  const request = durableRequest(); await service.prepare(request);
  const restored = structuredClone(request); restored.jobId = restored.input.jobId = 'restored-job'; restored.runId = restored.input.workflow.runId = 'restored-run'; restored.attemptId = restored.input.workflow.attemptId = 'restored-attempt';
  await expect(service.prepare(restored)).rejects.toThrow('exclusive background Build ownership');
});
it('uses an explicitly captured wall deadline while a quiet job without one remains alive', async () => {
  let now = Date.now(); const journal = await store(() => now); let hooks: WorkerHooks | undefined;
  const service = new WorkerService(journal, async (_request, context) => { hooks = context; await new Promise<void>((_resolve, reject) => context.signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true })); return {}; });
  const request = durableRequest(); request.policy.maxRuntimeSeconds = 360000; request.input.workflow.step.execution = request.policy;
  const ref = await service.prepare(request); await service.start(ref); await vi.waitFor(() => expect(hooks).toBeDefined());
  now += 360001 * 1000; await service.tick(); await service.settle();
  expect(hooks?.signal.aborted).toBe(true); expect(service.inspect(ref)).toMatchObject({ phase: 'failed', error: expect.stringContaining('deadline elapsed') });
});
