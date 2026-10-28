// @vitest-environment happy-dom
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { expect, it } from 'vitest';
import RequestValuesPanel from '../../../presentation/components/coforge/RequestValuesPanel.vue';
import { workflowUiFixture } from './workflow-ui-fixture';
import { REQUEST_OBJECT_FORMAT } from '../../../features/coforge/domain/request-object';
import { ideaFingerprint } from '../../../features/coforge/domain/integrity';

const control = (wrapper: VueWrapper, label: string) => {
  const field = wrapper.findAll('label').find(item => item.find('span').exists() && item.find('span').text() === label);
  if (!field) throw new Error(`Missing captured field: ${label}`);
  return field.find('input,textarea,select');
};
const action = (wrapper: VueWrapper, label: string) => {
  const button = wrapper.findAll('button').find(item => item.text().trim() === label);
  if (!button) throw new Error(`Missing captured-field action: ${label}`);
  return button;
};
async function fixture() {
  const env = await workflowUiFixture();
  await env.studio.updateProject({ requestObject: { format: REQUEST_OBJECT_FORMAT, className: 'Business Idea', fields: [{ key: 'audience', label: 'Audience', type: 'text' }, { key: 'investment', label: 'Investment', type: 'number', defaultValue: 0 }] } }, env.project.id);
  await env.studio.createIdea({ title: 'An idea with a captured object', description: 'Retain the original object definition.', category: 'Gameplay', username: 'Owner', requestValues: { audience: 'Makers', investment: 0 } });
  const idea = env.studio.state().ideas[0]!;
  const wrapper = mount(RequestValuesPanel, { props: { idea }, global: { plugins: [env.pinia, env.provider] } });
  const stop = env.studio.subscribe(state => {
    const current = state.ideas.find(item => item.id === idea.id);
    if (current) void wrapper.setProps({ idea: current });
  });
  await flushPromises();
  return { ...env, wrapper, id: idea.id, async dispose() { wrapper.unmount(); stop(); await env.dispose(); } };
}

it('keeps a failed values draft, then edits against its captured schema after project settings change', async () => {
  const env = await fixture();
  try {
    await env.studio.updateProject({ requestObject: { format: REQUEST_OBJECT_FORMAT, className: 'Feature Idea', fields: [] } }, env.project.id);
    await flushPromises();
    expect(env.wrapper.text()).toContain('Business Idea');
    await control(env.wrapper, 'Audience').setValue('Artists');
    env.storage.failNextSave = true;
    expect(action(env.wrapper, 'Save request fields').attributes('type')).toBe('submit');
    await env.wrapper.get('form').trigger('submit'); await flushPromises();
    expect(env.wrapper.get('[role="alert"]').text()).toContain('Disk full');
    expect(control(env.wrapper, 'Audience').element).toHaveProperty('value', 'Artists');
    expect(env.studio.state().ideas[0]?.requestObject?.values.audience).toBe('Makers');
    await env.wrapper.get('form').trigger('submit'); await flushPromises();
    expect(env.studio.state().ideas[0]?.requestObject).toMatchObject({ className: 'Business Idea', values: { audience: 'Artists', investment: 0 } });
    expect(env.wrapper.get('[role="status"]').text()).toContain('saved');
  } finally { await env.dispose(); }
});

it('preserves an authored values draft when another edit changes the request, and explicitly reloads on discard', async () => {
  const env = await fixture();
  try {
    await control(env.wrapper, 'Audience').setValue('Keep this local draft');
    const before = env.studio.state().ideas[0]!;
    await env.studio.updateRequestValues(env.id, { audience: 'An external update', investment: 0 }, ideaFingerprint(before));
    await flushPromises();
    expect(control(env.wrapper, 'Audience').element).toHaveProperty('value', 'Keep this local draft');
    expect(action(env.wrapper, 'Save request fields').attributes('disabled')).toBeDefined();
    expect(env.wrapper.text()).toContain('changed outside');
    await action(env.wrapper, 'Discard field changes').trigger('click'); await flushPromises();
    expect(control(env.wrapper, 'Audience').element).toHaveProperty('value', 'An external update');
    expect(action(env.wrapper, 'Save request fields').attributes('disabled')).toBeDefined();
  } finally { await env.dispose(); }
});
