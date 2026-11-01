import { afterEach, expect, it } from 'vitest';
import { durableFixture } from './durable-build-fixture';
import { increment } from './configured-workflow-fixture';
import { managedWorkflowContinuation } from '../../../features/coforge/application/managed-workflow-continuation';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); });
async function stopped() {
  const f = await durableFixture(); stops.push(() => f.engine.stop());
  await f.engine.startWorkflow(f.id); await f.engine.waitUntilIdle();
  const original = f.store.snapshot().jobs[0]!;
  const snapshot = f.worker.snapshots.get(original.id)!;
  snapshot.sequence++; snapshot.phase = 'failed'; snapshot.error = 'Agent connection closed before its final result.';
  snapshot.workspaceCaptured = true; snapshot.workspaceId = 'bg-original'; snapshot.increment = { ...increment, simulated: false };
  f.worker.acknowledge.mockRejectedValueOnce(new Error('Temporary acknowledgement disconnect'));
  await expect(f.engine.reconcileDurableBuild(f.id)).rejects.toThrow('could not be contacted');
  const status = () => { const state = f.store.snapshot(); return managedWorkflowContinuation(state.ideas.find(idea => idea.id === f.id)?.workflowRun, state.jobs); };
  return { ...f, original, status, run: () => f.store.snapshot().ideas.find(idea => idea.id === f.id)!.workflowRun! };
}
it('finishes a pending terminal acknowledgement before one explicit Continue reuses the exact original workspace', async () => {
  const f = await stopped(); expect(f.status()).toBe('settling');
  expect(f.worker.providerLaunches).toHaveLength(1);
  await f.engine.runWorkflowStep(f.id); await f.engine.waitUntilIdle();
  expect(f.worker.providerLaunches).toHaveLength(2); expect(f.worker.requests[1]?.input.workflow.workspaceId).toBe('bg-original');
  expect(f.run().attempts).toHaveLength(2); expect(f.run().attempts[0]?.status).toBe('failed');
  expect(f.worker.requests[1]?.input.workflow.backgroundRetryId).toBeUndefined();
});
it('does not turn an unknown or foreign original resource into permission to start another agent', async () => {
  const f = await stopped();
  await f.store.transaction(state => { state.jobs[0]!.durable!.snapshot!.phase = 'attention'; });
  expect(f.status()).toBe('unverified');
  await expect(f.engine.runWorkflowStep(f.id)).rejects.toThrow('original');
  expect(f.worker.providerLaunches).toHaveLength(1); expect(f.run().attempts).toHaveLength(1);
});
it('does not bypass an explicit user Stop or upgrade an already admitted legacy attempt', async () => {
  const f = await stopped();
  await f.engine.reconcileDurableBuild(f.id); expect(f.status()).toBe('ready');
  await f.store.transaction(state => { state.workflowStopHolds = [f.id]; });
  await expect(f.engine.runWorkflowStep(f.id)).rejects.toThrow('stopped');
  expect(f.worker.providerLaunches).toHaveLength(1);
  await f.store.transaction(state => { delete state.jobs[0]!.workflow!.lifecycle; });
  expect(f.status()).toBeUndefined();
});
