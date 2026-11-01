import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { WorkerStore, workerSnapshot } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { workerNativeRuntimeHooks, recoverWorkerNativeRuntime } from '../../../infrastructure/coforge/durable-worker/native-runtime';
import { durableRequest } from './durable-worker-fixture';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-worker-native-runtime-')); folders.push(directory);
  const store = new WorkerStore(new WorkerFiles(directory), 'worker'); await store.initialize();
  const request = durableRequest(); request.policy.maxRuntimeSeconds = 60; request.input.workflow.step.execution = request.policy;
  request.input.workflow.step.provider = request.input.settings.provider = 'codex'; request.input.workflow.step.model = request.input.settings.model = 'gpt-6.1-sol';
  request.input.workflow.step.nativeTools = { delegation: { maxConcurrent: 1 } };
  const ref = await store.prepare(request);
  const runtime = { runId: request.runId, attemptId: request.attemptId, projectId: request.projectId, directory: '/private/original', ownerToken: 'b'.repeat(64) };
  const identity = { pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) };
  return { store, ref, runtime, identity };
}
it('persists opaque preparation privately and permits contract cleanup only for the original finalized provider', async () => {
  const f = await fixture(); const hooks = workerNativeRuntimeHooks(f.store, f.ref);
  await hooks.nativeRuntime(f.runtime);
  expect(f.store.get(f.ref).record.nativeRuntime).toEqual(f.runtime);
  expect(JSON.stringify(workerSnapshot(f.store.get(f.ref).record))).not.toContain(f.runtime.ownerToken);
  await f.store.update(f.ref, next => { next.provider = { pid: f.identity.pid, launchId: 'launch', identity: f.identity, startedAt: new Date().toISOString() }; next.snapshot.phase = 'running'; });
  await hooks.nativeProcess({ runId: f.runtime.runId, attemptId: f.runtime.attemptId, projectId: f.runtime.projectId, identity: f.identity, phase: 'launched', observedAt: new Date().toISOString(), privateRuntime: f.runtime });
  await expect(hooks.nativeRuntime(undefined)).rejects.toThrow('quiescent');
  await expect(hooks.nativeProcess({ runId: f.runtime.runId, attemptId: f.runtime.attemptId, projectId: f.runtime.projectId, identity: { ...f.identity, birth: 'foreign' }, phase: 'terminated', observedAt: new Date().toISOString() })).rejects.toThrow('original OS provider');
  await f.store.update(f.ref, next => { next.snapshot.phase = 'finalizing'; });
  await hooks.nativeProcess({ runId: f.runtime.runId, attemptId: f.runtime.attemptId, projectId: f.runtime.projectId, identity: f.identity, phase: 'terminated', observedAt: new Date().toISOString(), privateRuntime: f.runtime });
  expect(f.store.get(f.ref).record.provider?.contractCompletedAt).toBeDefined();
  expect(f.store.get(f.ref).record.provider?.treeTerminatedAt).toBeUndefined();
  await hooks.nativeRuntime(undefined); expect(f.store.get(f.ref).record.nativeRuntime).toBeUndefined();
});
it.each(['unstarted', 'contract', 'unknown'] as const)('cleans %s original private runtime without paid execution or unsafe ownership assumptions', async state => {
  const f = await fixture(); const retained = structuredClone(f.store.get(f.ref).record); retained.nativeRuntime = f.runtime;
  if (state !== 'unstarted') retained.provider = { pid: f.identity.pid, launchId: 'launch', identity: f.identity, startedAt: new Date().toISOString(), ...(state === 'contract' ? { contractCompletedAt: new Date().toISOString() } : {}) };
  const purge = vi.fn(async () => {});
  expect(await recoverWorkerNativeRuntime(retained, purge)).toBe(state !== 'unknown');
  expect(purge).toHaveBeenCalledTimes(state === 'unknown' ? 0 : 1);
  expect(retained.nativeRuntime).toEqual(state === 'unknown' ? f.runtime : undefined);
});
