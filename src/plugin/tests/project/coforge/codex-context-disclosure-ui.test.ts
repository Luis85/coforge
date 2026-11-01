// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowCapturedConfiguration from '../../../presentation/components/coforge/WorkflowCapturedConfiguration.vue';
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { ai, definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

it('discloses SDK-owned global context beside captured native Codex policy without implying permission or external-client provenance', async () => {
  const f = await workflowUiFixture(); const at = '2026-11-01T08:00:00Z';
  const run: WorkflowRun = { id: 'captured-run', ideaId: 'CF-800', projectId: f.project.id, definition: definition([{ ...ai('analysis'), provider: 'codex', model: 'gpt-6.1-sol', nativeTools: { delegation: { maxConcurrent: 2 } } }]), proposalRevision: 'proposal', revision: 1, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: at, updatedAt: at };
  const wrapper = mount(WorkflowCapturedConfiguration, { props: { run }, global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  try {
    expect(wrapper.text()).toContain('global AGENTS.md and skills');
    expect(wrapper.text()).toContain('do not grant tools');
    expect(wrapper.text()).toContain('maximum 2 concurrent');
    f.store.state!.projects![0]!.settings.provider = 'claude';
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('global AGENTS.md and skills');
    await wrapper.setProps({ run: { ...run, external: true } });
    expect(wrapper.text()).not.toContain('global AGENTS.md and skills');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
