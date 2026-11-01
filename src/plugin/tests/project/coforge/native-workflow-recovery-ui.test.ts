// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import NativeWorkflowRecovery from '../../../presentation/components/coforge/NativeWorkflowRecovery.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { ai } from './configured-workflow-fixture';

it('offers exact parent recovery and explicit cessation acknowledgement without starting a provider or releasing Stop', async () => {
  const f = await workflowUiFixture();
  const at = '2026-11-01T08:00:00Z';
  await f.studio.store.transaction(state => {
    state.workflowStopHolds = ['CF-800'];
    state.jobs.push({ id: 'original-parent', ideaId: 'CF-800', projectId: f.project.id, provider: 'claude', stage: 'plan', status: 'failed', startedAt: at, finishedAt: at, logs: [],
      workflow: { runId: 'original-run', attemptId: 'original-attempt', definitionRevision: 'revision', proposalRevision: 'proposal', inputArtifacts: [], step: { ...ai('analysis'), provider: 'claude', nativeTools: { delegation: { maxConcurrent: 2 } } } },
      nativeProcess: { runId: 'original-run', attemptId: 'original-attempt', projectId: f.project.id, phase: 'unknown', observedAt: at, identity: { pid: 123, birth: 'original-birth', image: 'a'.repeat(64), platform: 'win32' } } });
  });
  const check = vi.spyOn(f.studio, 'checkNativeWorkflowRecovery').mockResolvedValue(undefined);
  const wrapper = mount(NativeWorkflowRecovery, { props: { jobId: 'original-parent' }, global: { plugins: [f.pinia, f.provider] } });
  try {
    const buttons = () => wrapper.findAll('button');
    const acknowledge = () => buttons().find(button => button.text() === 'Record operator acknowledgement')!;
    expect(wrapper.text()).toContain('captured root PID 123');
    expect(acknowledge().attributes('disabled')).toBeDefined();
    await buttons().find(button => button.text() === 'Check original execution')!.trigger('click');
    await flushPromises(); expect(check).toHaveBeenCalledWith('original-parent');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await f.studio.store.transaction(state => { state.jobs[0]!.nativeProcess!.observedAt = '2026-11-01T08:01:00Z'; });
    await flushPromises();
    expect(acknowledge().attributes('disabled')).toBeDefined();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await acknowledge().trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('not OS termination proof');
    expect(f.studio.state().jobs[0]!.nativeProcess).toMatchObject({ phase: 'unknown', operatorAcknowledgedAt: expect.any(String) });
    expect(f.studio.state().workflowStopHolds).toContain('CF-800');
    expect(f.studio.state().jobs).toHaveLength(1);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); check.mockRestore(); await f.dispose(); }
});

it('shows orphaned private preparation without inventing a provider PID or asking for assistant cessation acknowledgement', async () => {
  const f = await workflowUiFixture(); const at = '2026-11-01T08:00:00Z';
  await f.studio.store.transaction(state => {
    state.jobs.push({ id: 'prepared-only', ideaId: 'CF-800', projectId: f.project.id, provider: 'codex', stage: 'plan', status: 'failed', startedAt: at, finishedAt: at, logs: [],
      workflow: { runId: 'prepared-run', attemptId: 'prepared-attempt', definitionRevision: 'revision', proposalRevision: 'proposal', inputArtifacts: [], step: { ...ai('analysis'), provider: 'codex', model: 'gpt-6.1-sol', nativeTools: { delegation: { maxConcurrent: 1 } } } },
      nativeRuntime: { runId: 'prepared-run', attemptId: 'prepared-attempt', projectId: f.project.id, directory: '/private/native', ownerToken: 'a'.repeat(64) } });
  });
  const check = vi.spyOn(f.studio, 'checkNativeWorkflowRecovery').mockImplementation(async () => { await f.studio.store.transaction(state => { delete state.jobs[0]!.nativeRuntime; }); });
  const wrapper = mount(NativeWorkflowRecovery, { props: { jobId: 'prepared-only' }, global: { plugins: [f.pinia, f.provider] } });
  try {
    expect(wrapper.text()).toContain('Private preparation was interrupted before a provider process was recorded');
    expect(wrapper.text()).not.toContain('captured root PID'); expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    await wrapper.get('button').trigger('click'); await flushPromises();
    expect(check).toHaveBeenCalledWith('prepared-only'); expect(wrapper.find('[aria-label="Original native execution recovery"]').exists()).toBe(false);
    expect(f.runner).not.toHaveBeenCalled(); expect(f.studio.state().jobs).toHaveLength(1);
  } finally { wrapper.unmount(); check.mockRestore(); await f.dispose(); }
});
