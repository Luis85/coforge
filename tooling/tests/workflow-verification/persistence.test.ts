import { expect, it } from 'vitest';
import { verificationFixture } from './fixture';
import { seededStore } from '../../../src/plugin/tests/project/coforge/memory-storage';
import { StudioStore } from '../../../src/plugin/features/coforge/application/studio-store';
import { recordWorkflowVerification, recordWorkflowVerificationRuntime } from '../../../src/plugin/features/coforge/application/workflow-verification';

it('persists actual Docker outcomes through application callbacks before container admission and after application-store reload', async () => {
  const f = await verificationFixture(`console.log('Actual isolated command completed');`);
  const { store, storage } = await seededStore();
  await store.transaction(state => {
    state.integration.workflowVerification = f.profile;
    state.jobs.push({ id: f.input.jobId!, ideaId: f.input.idea.id, projectId: f.input.idea.projectId, stage: 'implement', provider: 'codex', status: 'running', startedAt: new Date().toISOString(), logs: [], workflow: f.input.workflow });
  });
  const observed = f.input.onVerification!;
  f.input.onVerification = async record => { await recordWorkflowVerification(store, f.input.jobId!, record); await observed(record); };
  const lifecycle = f.input.onVerificationRuntime!;
  f.input.onVerificationRuntime = async record => {
    expect((await storage.load()).data?.jobs.at(-1)?.verification?.find(item => item.id === record.verificationId)).toBeDefined();
    await recordWorkflowVerificationRuntime(store, f.input.jobId!, record); await lifecycle(record);
  };
  const session = await f.open(); const result = await session.run({ commandId: 'check' });
  expect(result).toMatchObject({ status: 'completed', exitCode: 0 });
  expect(store.snapshot().jobs.at(-1)?.verification).toEqual([result]);
  expect(store.snapshot().jobs.at(-1)?.verificationRuntime?.at(-1)?.phase).toBe('terminal');
  const reloaded = new StudioStore(storage); await reloaded.init();
  expect(reloaded.snapshot().jobs.at(-1)?.verification).toEqual([result]);
  expect(reloaded.snapshot().jobs.at(-1)?.verificationRuntime?.at(-1)?.phase).toBe('terminal');
  expect(reloaded.snapshot().jobs.at(-1)?.status).toBe('failed');
  expect(session.records()).toHaveLength(1);
});
