import { afterEach, expect, it, vi } from 'vitest';
import { ai, fixture, increment } from './configured-workflow-fixture';
import { providerFailureFor } from '../../../features/coforge/domain/provider-failure';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { recoverForegroundVerification } from '../../../infrastructure/coforge/verification/foreground-recovery';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function retained(managed = true) {
  const f = await fixture([{ ...ai('build', 'codechange', 'editworktree'), provider: 'claude', automatic: false }]);
  stops.push(() => f.engine.stop()); await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
  const events: string[] = [];
  await f.store.transaction(state => {
    const job = state.jobs[0]!; const run = state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!;
    job.status = 'failed'; job.failure = providerFailureFor('incomplete_output'); job.error = job.failure.summary;
    job.workflow!.workspaceId = 'original-workspace'; run.workspaceId = 'original-workspace';
    job.workflow!.lifecycle = managed ? { version: 1, mode: 'managed-session' } : undefined;
    run.state = 'attention'; delete run.activeAttemptId;
    const owner = { runId: job.workflow!.runId, attemptId: job.workflow!.attemptId, projectId: job.projectId! };
    job.nativeProcess = { ...owner, identity: { pid: 123, platform: 'win32', birth: 'original', image: 'a'.repeat(64) }, phase: 'unknown', observedAt: new Date().toISOString(),
      lifetime: { ...owner, version: 1, kind: 'windows-job', directory: '/owned/private', ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64) } };
  });
  const recoverStopped = vi.fn(async () => {
    expect(f.store.snapshot().jobs[0]!.nativeProcess?.phase).toBe('terminated'); events.push('workspace');
    return { ...increment, simulated: false, snapshotHash: 'd'.repeat(64) };
  });
  const workspaces: WorkflowWorkspaces = { start: async () => {}, acquire: async () => { throw new Error('Recovery must not launch or reacquire a provider lease'); },
    assertReviewable: async () => {}, acknowledge: async () => {}, recoverStopped };
  const stopped = vi.fn(async () => { events.push('stopped'); return 'terminal' as const; });
  return { ...f, events, stopped, workspaces, recoverStopped, job: () => f.store.snapshot().jobs[0]! };
}
it('automatically reconciles proven stopped original resources and partial edits without dispatching another agent', async () => {
  const f = await retained(); const original = f.job();
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, undefined, f.workspaces);
  expect(f.events).toEqual(['stopped', 'workspace']);
  expect(f.recoverStopped).toHaveBeenCalledWith({ workspaceId: 'original-workspace', runId: original.workflow!.runId, projectId: original.projectId, attemptId: original.workflow!.attemptId, capture: true });
  expect(f.job().status).toBe('failed'); expect(f.job().failure).toEqual(original.failure); expect(f.runner).toHaveBeenCalledTimes(1);
  const run = f.current().workflowRun!;
  expect(run.state).toBe('attention'); expect(run.artifacts).toHaveLength(1); expect(run.artifacts[0]).toMatchObject({ hostSnapshot: true, attemptId: original.workflow!.attemptId, increment: { simulated: false } });
  expect(f.store.snapshot().workflowStopHolds ?? []).not.toContain(f.idea.id);
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, undefined, f.workspaces);
  expect(f.current().workflowRun!.artifacts).toHaveLength(1);
});
it('does not capture or release a session whose original lifetime remains unknown', async () => {
  const f = await retained(); const unknown = vi.fn(async () => 'unknown' as const);
  await recoverForegroundVerification(f.store, undefined, unknown, undefined, undefined, f.workspaces);
  expect(f.recoverStopped).not.toHaveBeenCalled(); expect(f.job().nativeProcess?.phase).toBe('unknown');
  expect(f.current().workflowRun!.artifacts).toHaveLength(0); expect(f.runner).toHaveBeenCalledTimes(1);
  expect(f.store.snapshot().workflowStopHolds ?? []).not.toContain(f.idea.id);
});
it('preserves an explicit Stop hold and never resumes or advances it during automatic cleanup', async () => {
  const f = await retained(); await f.store.transaction(state => { state.workflowStopHolds = [f.idea.id]; state.ideas.find(idea => idea.id === f.idea.id)!.status = 'inbox'; });
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, undefined, f.workspaces);
  expect(f.store.snapshot().workflowStopHolds).toEqual([f.idea.id]); expect(f.current().status).toBe('inbox'); expect(f.runner).toHaveBeenCalledTimes(1);
});
it('does not release a workspace belonging to a changed attempt or another active writer', async () => {
  const f = await retained(); await f.store.transaction(state => { state.jobs.push({ ...state.jobs[0]!, id: 'another-writer', status: 'running', nativeProcess: undefined }); });
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, undefined, f.workspaces);
  expect(f.recoverStopped).not.toHaveBeenCalled(); expect(f.current().workflowRun!.artifacts).toHaveLength(0);
});
it('retains legacy recovery behavior without granting automatic workspace release', async () => {
  const f = await retained(false);
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, undefined, f.workspaces);
  expect(f.job().nativeProcess?.phase).toBe('terminated'); expect(f.recoverStopped).not.toHaveBeenCalled();
});
it('cleans the exact private runtime before releasing files and holds failed cleanup without adding a user Stop', async () => {
  const f = await retained();
  await f.store.transaction(state => {
    const process = state.jobs[0]!.nativeProcess!;
    process.privateRuntime = { runId: process.runId, attemptId: process.attemptId, projectId: process.projectId, directory: '/owned/codex', ownerToken: 'e'.repeat(64) };
  });
  const purge = vi.fn(async (): Promise<void> => { f.events.push('purge'); throw new Error('PRIVATE_RUNTIME_FAILURE'); });
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, purge, f.workspaces);
  expect(f.events).toEqual(['stopped', 'purge']); expect(f.recoverStopped).not.toHaveBeenCalled();
  expect(f.job().nativeProcess?.privateRuntime).toBeDefined(); expect(f.store.snapshot().workflowStopHolds ?? []).not.toContain(f.idea.id);
  purge.mockImplementation(async () => { f.events.push('purge'); });
  await recoverForegroundVerification(f.store, undefined, f.stopped, undefined, purge, f.workspaces);
  expect(f.job().nativeProcess?.privateRuntime).toBeUndefined(); expect(f.events.at(-1)).toBe('workspace');
});
it('does not publish recovered changes if original attribution changes during workspace reconciliation', async () => {
  const f = await retained();
  f.recoverStopped.mockImplementation(async () => {
    await f.store.transaction(state => { state.jobs[0]!.nativeProcess!.identity.birth = 'changed-original'; });
    return { ...increment, simulated: false, snapshotHash: 'd'.repeat(64) };
  });
  await expect(recoverForegroundVerification(f.store, undefined, f.stopped, undefined, undefined, f.workspaces)).rejects.toThrow('changed during automatic recovery');
  expect(f.current().workflowRun!.artifacts).toHaveLength(0); expect(f.runner).toHaveBeenCalledTimes(1);
});
