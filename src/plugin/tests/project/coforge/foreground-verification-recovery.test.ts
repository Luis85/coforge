import { expect, it, vi } from 'vitest';
import { seededStore } from './memory-storage';
import { recoverForegroundVerification } from '../../../infrastructure/coforge/verification/foreground-recovery';
import type { WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';

it.each(['terminal', 'unknown'] as const)('retains %s container recovery without replaying or exposing ownership', async outcome => {
  const { store } = await seededStore();
  const ideaId = store.internalSnapshot().ideas[0]!.id;
  const runtime: WorkflowVerificationRuntimeRecord = { verificationId: 'verification', containerName: 'coforge-original', ownerToken: 'private-owner', dockerBin: 'docker', endpoint: 'npipe:////./pipe/docker_engine',
    imageId: 'sha256:' + 'a'.repeat(64), sourceDirectory: '/private/source', sourceHash: 'b'.repeat(64), commandId: 'tests', runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', phase: 'started', startedAt: new Date().toISOString() };
  await store.transaction(state => { state.jobs.push({ id: 'original', ideaId, stage: 'implement', status: 'failed', provider: 'claude', startedAt: runtime.startedAt, logs: [], verificationRuntime: [runtime],
    verification: [{ id: runtime.verificationId, runId: runtime.runId, attemptId: runtime.attemptId, projectId: runtime.projectId, commandId: runtime.commandId, label: 'Tests', executable: 'node', args: ['test.js'],
      runtime: 'docker', imageId: runtime.imageId, sourceHash: runtime.sourceHash, startedAt: runtime.startedAt, status: 'running', output: '', truncated: false }] }); });
  const recover = vi.fn(async () => outcome);
  await recoverForegroundVerification(store, recover);
  expect(recover).toHaveBeenCalledExactlyOnceWith(runtime);
  const job = store.internalSnapshot().jobs.find(item => item.id === 'original')!;
  expect(job.verificationRuntime?.[0]?.phase).toBe(outcome === 'terminal' ? 'terminal' : 'started');
  expect(job.verification?.[0]?.status).toBe(outcome === 'terminal' ? 'interrupted' : 'unknown');
  if (outcome === 'unknown') expect(store.internalSnapshot().workflowStopHolds).toContain(ideaId);
});
it.each(['terminal', 'unknown'] as const)('recovers only the original orphan native provider and retains %s ownership honestly', async outcome => {
  const { store } = await seededStore(); const ideaId = store.internalSnapshot().ideas[0]!.id;
  const nativeProcess = { runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', identity: { pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) },
    phase: 'unknown' as const, observedAt: new Date().toISOString() };
  await store.transaction(state => { state.jobs.push({ id: 'original-provider', ideaId, stage: 'plan', provider: 'claude', status: 'failed', startedAt: nativeProcess.observedAt, logs: [], nativeProcess }); });
  const recoverProvider = vi.fn(async () => outcome); const recoverContainer = vi.fn(async () => 'terminal' as const);
  await recoverForegroundVerification(store, recoverContainer, recoverProvider);
  expect(recoverProvider).toHaveBeenCalledExactlyOnceWith(nativeProcess);
  expect(recoverContainer).not.toHaveBeenCalled();
  expect(store.internalSnapshot().jobs.find(job => job.id === 'original-provider')!.nativeProcess?.phase).toBe(outcome === 'terminal' ? 'terminated' : 'unknown');
  if (outcome === 'unknown') expect(store.internalSnapshot().workflowStopHolds).toContain(ideaId);
});
it.each(['prepared', 'terminated'] as const)('purges only the %s original private runtime and keeps failed cleanup quarantined', async phase => {
  const { store } = await seededStore(); const ideaId = store.internalSnapshot().ideas[0]!.id;
  const runtime = { directory: '/private/original', ownerToken: 'b'.repeat(64), runId: 'run', attemptId: 'attempt', projectId: 'CFP-001' };
  await store.transaction(state => { state.jobs.push({ id: 'private-owner', ideaId, stage: 'plan', provider: 'codex', status: 'failed', startedAt: new Date().toISOString(), logs: [],
    ...(phase === 'prepared' ? { nativeRuntime: runtime } : { nativeProcess: { runId: runtime.runId, attemptId: runtime.attemptId, projectId: runtime.projectId,
      identity: { pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }, phase: 'terminated', observedAt: new Date().toISOString(), privateRuntime: runtime } }) }); });
  const recoverProvider = vi.fn(async () => 'unknown' as const); const recoverContainer = vi.fn(async () => 'terminal' as const);
  const purge = vi.fn(async (): Promise<void> => { throw new Error('Private ownership changed'); });
  await recoverForegroundVerification(store, recoverContainer, recoverProvider, undefined, purge);
  expect(purge).toHaveBeenCalledExactlyOnceWith(runtime); expect(recoverProvider).not.toHaveBeenCalled();
  expect(store.internalSnapshot().workflowStopHolds).toContain(ideaId);
  purge.mockImplementation(async () => {});
  await recoverForegroundVerification(store, recoverContainer, recoverProvider, 'private-owner', purge);
  const current = store.internalSnapshot().jobs.find(job => job.id === 'private-owner')!;
  expect(current.nativeRuntime).toBeUndefined(); expect(current.nativeProcess?.privateRuntime).toBeUndefined();
});
it('reconciles a lost public terminal write from an already stopped container without replay or an invented exit', async () => {
  const { store } = await seededStore(); const ideaId = store.internalSnapshot().ideas[0]!.id; const startedAt = new Date().toISOString();
  const runtime: WorkflowVerificationRuntimeRecord = { verificationId: 'lost-result', containerName: 'coforge-original', ownerToken: 'private-owner', dockerBin: 'docker', endpoint: 'npipe:////./pipe/docker_engine',
    imageId: 'sha256:' + 'a'.repeat(64), sourceDirectory: '/private/source', sourceHash: 'b'.repeat(64), commandId: 'tests', runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', phase: 'terminal', startedAt, terminalAt: startedAt };
  await store.transaction(state => { state.jobs.push({ id: 'lost-terminal', ideaId, provider: 'claude', stage: 'plan', status: 'failed', startedAt, logs: [], verificationRuntime: [runtime],
    verification: [{ id: runtime.verificationId, runId: runtime.runId, attemptId: runtime.attemptId, projectId: runtime.projectId, sourceHash: runtime.sourceHash, commandId: runtime.commandId,
      label: 'Checks', executable: 'node', args: ['--test'], runtime: 'docker', imageId: runtime.imageId, startedAt, status: 'running', output: '', truncated: false }] }); });
  const recover = vi.fn(async () => 'terminal' as const);
  await recoverForegroundVerification(store, recover);
  expect(recover).not.toHaveBeenCalled();
  const observed = store.internalSnapshot().jobs.find(job => job.id === 'lost-terminal')!.verification![0]!;
  expect(observed.status).toBe('unknown'); expect(observed.finishedAt).toBeDefined(); expect(observed.exitCode).toBeUndefined();
  expect(observed.output).toContain('not durably observed');
});
