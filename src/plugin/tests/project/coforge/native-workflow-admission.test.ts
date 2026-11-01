import { expect, it } from 'vitest';
import { ai, fixture } from './configured-workflow-fixture';
import { recordWorkflowVerification } from '../../../features/coforge/application/workflow-verification';
import { assertVerificationSettled } from '../../../features/coforge/application/verification-admission';
import type { WorkflowVerificationRecord, WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';

const imageId = `sha256:${'a'.repeat(64)}`;
const profile = { enabled: true, dockerBin: 'docker', imageId, timeoutSeconds: 600, maxRuns: 8, commands: [{ id: 'test', label: 'Tests', executable: 'npm', args: ['test'] }] };

it('requires an independent host grant and captures it with the exact queued native step', async () => {
  const step = { ...ai('verify', 'markdown', 'readproject'), provider: 'claude' as const, nativeTools: { verification: { commandIds: ['test'] } } };
  const f = await fixture([step]);
  await expect(f.engine.startWorkflow(f.idea.id)).rejects.toThrow('Vault integrations');
  expect(f.store.snapshot().jobs).toEqual([]);
  await f.store.transaction(state => { state.integration.workflowVerification = structuredClone(profile); });
  await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
  const job = f.store.snapshot().jobs.at(-1)!;
  expect(job.workflow?.verificationProfile).toEqual(profile);
  await f.store.transaction(state => { state.integration.workflowVerification!.commands[0]!.args = ['changed-later']; });
  expect(f.store.snapshot().jobs.at(-1)?.workflow?.verificationProfile?.commands[0]?.args).toEqual(['test']);
  await f.engine.stop();
});

it('persists running command evidence before continuing and retains terminal evidence after the agent fails', async () => {
  let captured: WorkflowVerificationRecord | undefined;
  const f = await fixture([{ ...ai('verify', 'markdown', 'readproject'), provider: 'claude', nativeTools: { verification: { commandIds: ['test'] } } }], async input => {
    const record: WorkflowVerificationRecord = { id: 'check-1', runId: input.workflow!.runId, attemptId: input.workflow!.attemptId, projectId: input.idea.projectId!, commandId: 'test', label: 'Tests', executable: 'npm', args: ['test'], runtime: 'docker', imageId, sourceHash: 'b'.repeat(64), startedAt: '2026-11-01T08:00:00Z', status: 'running', output: '', truncated: false };
    await input.onVerification?.(record);
    expect((await f.storage.load()).data?.jobs.at(-1)?.verification).toEqual([record]);
    captured = { ...record, status: 'completed', finishedAt: '2026-11-01T08:01:00Z', exitCode: 0, output: '1 test passed' };
    await input.onVerification?.(captured);
    throw new Error('Model returned no structured output');
  });
  await f.store.transaction(state => { state.integration.workflowVerification = structuredClone(profile); });
  await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
  const job = f.store.snapshot().jobs.at(-1)!;
  expect(job.status).toBe('failed');
  expect(job.verification).toEqual([captured]);
  await expect(recordWorkflowVerification(f.store, job.id, { ...captured!, output: 'Replacement claim' })).rejects.toThrow('cannot be overwritten');
  await expect(recordWorkflowVerification(f.store, job.id, { ...captured!, id: 'forged', commandId: 'ungranted' })).rejects.toThrow('does not belong');
  await f.engine.stop();
});

it('preserves independent same-project concurrency and blocks the original request until its container ownership is terminal', async () => {
  const f = await fixture([ai('analysis')]);
  const runtime: WorkflowVerificationRuntimeRecord = { verificationId: 'old-check', runId: 'old-run', attemptId: 'old-attempt', projectId: f.idea.projectId!, commandId: 'test', imageId, dockerBin: 'docker', endpoint: 'npipe:////./pipe/docker_engine', containerName: 'coforge-owned', ownerToken: 'private', sourceDirectory: '/private/source', sourceHash: 'b'.repeat(64), phase: 'started', startedAt: '2026-11-01T08:00:00Z' };
  await f.store.transaction(state => { state.jobs.push({ id: 'old-job', ideaId: 'CF-999', projectId: f.idea.projectId, provider: 'claude', stage: 'plan', status: 'failed', startedAt: runtime.startedAt, logs: [], verificationRuntime: [runtime] }); });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).not.toThrow();
  await f.store.transaction(state => { state.jobs[0]!.ideaId = f.idea.id; });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).toThrow('Recover the original');
  await expect(f.engine.startWorkflow(f.idea.id)).rejects.toThrow('Recover the original');
  await f.store.transaction(state => { state.jobs[0]!.verificationRuntime![0]!.phase = 'terminal'; });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.idea.id)).not.toThrow();
  await f.engine.stop();
});
