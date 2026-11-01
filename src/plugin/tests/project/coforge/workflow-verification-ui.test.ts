// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorkflowVerificationEvidence from '../../../presentation/components/coforge/WorkflowVerificationEvidence.vue';
import type { WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';

const sourceHash = 'b'.repeat(64);
const record: WorkflowVerificationRecord = { id: 'check-1', runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', commandId: 'test', label: 'Tests', executable: 'npm', args: ['run', 'test'], runtime: 'docker', imageId: `sha256:${'a'.repeat(64)}`, sourceHash, startedAt: '2026-11-01T08:00:00Z', finishedAt: '2026-11-01T08:01:00Z', status: 'completed', exitCode: 0, output: '<script>agent claim</script>\n1 test passed', truncated: true };

it('presents observed command outcomes literally and marks evidence stale after source changes', async () => {
  const wrapper = mount(WorkflowVerificationEvidence, { props: { records: [record], currentHash: sourceHash } });
  expect(wrapper.text()).toContain('Completed · exit 0');
  expect(wrapper.text()).toContain('Matches the captured source snapshot');
  expect(wrapper.text()).toContain('Output was truncated');
  expect(wrapper.get('[aria-label="Recorded output for Tests"]').text()).toContain('<script>agent claim</script>');
  expect(wrapper.find('script').exists()).toBe(false);
  await wrapper.setProps({ currentHash: 'c'.repeat(64) });
  expect(wrapper.text()).toContain('Earlier source snapshot · does not verify the current changes');
  expect(wrapper.find('button').exists()).toBe(false);
  wrapper.unmount();
});

it.each(['running', 'interrupted', 'unknown', 'unavailable'] as const)('keeps %s outcomes separate from completed verification', status => {
  const wrapper = mount(WorkflowVerificationEvidence, { props: { records: [{ ...record, status, exitCode: undefined, finishedAt: status === 'running' ? undefined : record.finishedAt }] } });
  expect(wrapper.text()).not.toContain('Completed · exit 0');
  expect(wrapper.text()).toContain('current snapshot match not recorded');
  wrapper.unmount();
});
