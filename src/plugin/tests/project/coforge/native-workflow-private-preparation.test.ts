import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { assertVerificationSettled } from '../../../features/coforge/application/verification-admission';
import { recordWorkflowNativeRuntime } from '../../../features/coforge/application/native-workflow-process';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageRunner } from '../../../features/coforge/application/ports';
import type { NativeWorkflowPrivateRuntime } from '../../../features/coforge/domain/native-workflow-process';
import { seededStore, nodeTimers } from './memory-storage';
import { ai, definition } from './configured-workflow-fixture';

async function fixture(run: StageRunner) {
  const { store, storage } = await seededStore();
  await store.transaction(state => {
    state.settings = { ...defaultSettings(), paused: false, workflow: definition([{ ...ai('inspect'), provider: 'codex', model: 'gpt-6.1-sol', nativeTools: { delegation: { maxConcurrent: 1 } } }]) };
    state.runtime.codexAvailable = true;
  });
  const idea = store.snapshot().ideas.find(item => item.status === 'inbox')!;
  const runner = vi.fn(run);
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner, codex: runner }, timers: nodeTimers() });
  return { store, storage, idea, runner, engine };
}

it('persists the cleanup capability before native input and atomically transfers it to the real original process receipt', async () => {
  let runtime: NativeWorkflowPrivateRuntime | undefined;
  const f = await fixture(async input => {
    runtime = { runId: input.workflow!.runId, attemptId: input.workflow!.attemptId, projectId: input.idea.projectId!, directory: '/synthetic/private-runtime', ownerToken: 'a'.repeat(64) };
    await input.onNativeRuntime!(runtime);
    expect((await f.storage.load()).data?.jobs.at(-1)?.nativeRuntime).toEqual(runtime);
    expect((await f.storage.load()).data?.jobs.at(-1)?.nativeProcess).toBeUndefined();
    const record = { runId: runtime.runId, attemptId: runtime.attemptId, projectId: runtime.projectId, identity: { pid: 123, platform: process.platform, birth: 'fixture', image: 'b'.repeat(64) }, phase: 'launched' as const, observedAt: new Date().toISOString(), privateRuntime: runtime };
    await input.onNativeProcess!(record);
    expect((await f.storage.load()).data?.jobs.at(-1)?.nativeRuntime).toBeUndefined();
    expect((await f.storage.load()).data?.jobs.at(-1)?.nativeProcess?.privateRuntime).toEqual(runtime);
    await input.onNativeProcess!({ ...record, phase: 'terminated' });
    await input.onNativeProcess!({ ...record, phase: 'terminated', privateRuntime: undefined });
    await input.onNativeRuntime!(undefined);
    return { markdown: '# Complete' };
  });
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs.at(-1)?.status).toBe('succeeded');
    expect(f.store.snapshot().jobs.at(-1)?.nativeProcess).toMatchObject({ phase: 'terminated' });
    expect(f.store.snapshot().jobs.at(-1)?.nativeProcess?.privateRuntime).toBeUndefined();
  } finally { await f.engine.stop(); }
});

it('retains failed private preflight without inventing a paid process and blocks a new request attempt until cleanup', async () => {
  const f = await fixture(async input => {
    await input.onNativeRuntime!({ runId: input.workflow!.runId, attemptId: input.workflow!.attemptId, projectId: input.idea.projectId!, directory: '/synthetic/private-runtime', ownerToken: 'a'.repeat(64) });
    throw new Error('Native preflight failed before provider input');
  });
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!;
    expect(job.status).toBe('failed'); expect(job.nativeRuntime).toBeDefined(); expect(job.nativeProcess).toBeUndefined();
    expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).toThrow('private runtime preparation');
    await expect(f.engine.startWorkflow(f.idea.id)).rejects.toThrow('private runtime preparation');
    expect(f.runner).toHaveBeenCalledOnce();
    await recordWorkflowNativeRuntime(f.store, job.id, undefined);
    expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).not.toThrow();
  } finally { await f.engine.stop(); }
});
