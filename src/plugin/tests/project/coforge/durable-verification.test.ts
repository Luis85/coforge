import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { WorkerStore } from '../../../infrastructure/coforge/durable-worker/store';
import { WorkerService } from '../../../infrastructure/coforge/durable-worker/service';
import { durableRequest } from './durable-worker-fixture';
import type { WorkflowVerificationRecord, WorkflowVerificationRuntimeRecord } from '../../../features/coforge/domain/workflow-verification';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
it('persists reservation and private ownership before execution and retains verification without a code diff', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'coforge-worker-verification-')); folders.push(folder);
  const store = new WorkerStore(new WorkerFiles(folder), 'worker', 1); await store.initialize();
  const request = durableRequest();
  request.input.workflow.step.nativeTools = { verification: { commandIds: ['tests'] } };
  request.input.workflow.verificationProfile = { enabled: true, dockerBin: 'docker', imageId: 'sha256:' + 'a'.repeat(64),
    commands: [{ id: 'tests', label: 'Tests', executable: 'node', args: ['test.js'] }], timeoutSeconds: 30, maxRuns: 2 };
  const record: WorkflowVerificationRecord = { id: 'verify-one', runId: request.runId, attemptId: request.attemptId, projectId: request.projectId,
    commandId: 'tests', label: 'Tests', executable: 'node', args: ['test.js'], runtime: 'docker', imageId: request.input.workflow.verificationProfile.imageId,
    sourceHash: 'b'.repeat(64), startedAt: new Date().toISOString(), status: 'running', output: '', truncated: false };
  const runtime: WorkflowVerificationRuntimeRecord = { verificationId: record.id, runId: record.runId, attemptId: record.attemptId, projectId: record.projectId,
    commandId: record.commandId, sourceHash: record.sourceHash, startedAt: record.startedAt, containerName: 'coforge-test-owned', ownerToken: 'private-owner',
    dockerBin: 'docker', endpoint: 'npipe:////./pipe/docker_engine', imageId: record.imageId, sourceDirectory: '/private/snapshot', phase: 'prepared' };
  const service = new WorkerService(store, async (_request, hooks) => {
    await hooks.verification!(record); await hooks.verificationRuntime!(runtime);
    const saved = store.all()[0]!;
    expect(saved.snapshot.verification).toEqual([record]);
    expect(saved.verificationRuntime).toEqual([runtime]);
    expect(JSON.stringify(service.inspect(saved.snapshot.ref))).not.toContain('private-owner');
    const completed: WorkflowVerificationRecord = { ...record, status: 'completed', exitCode: 0, finishedAt: new Date().toISOString(), output: 'one passed' };
    await hooks.verification!(completed);
    await hooks.verificationRuntime!({ ...runtime, phase: 'terminal', terminalAt: new Date().toISOString() });
    await expect(hooks.verification!({ ...completed, output: 'changed after completion' })).rejects.toThrow('overwritten');
    await expect(hooks.verificationRuntime!(runtime)).rejects.toThrow('regress');
    return { summary: 'Verified without edits', verification: [completed] };
  });
  const ref = await service.prepare(request); await service.start(ref); await service.settle();
  expect(service.inspect(ref)).toMatchObject({ phase: 'completed', verification: [{ status: 'completed' }], result: { verification: [{ exitCode: 0 }] } });
  const reloaded = new WorkerStore(new WorkerFiles(folder), 'worker', 1); await reloaded.initialize();
  expect(reloaded.get(ref).record.verificationRuntime?.[0]?.phase).toBe('terminal');
});
