// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import ChatPanel from '../../../presentation/components/coforge/ChatPanel.vue';
import { disconnectedTwitch } from '../../../features/coforge/domain/twitch';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture() {
  const env = await workflowUiFixture();
  await env.studio.loadSample();
  const wrapper = mount(ChatPanel, { global: { plugins: [env.pinia, env.provider], directives: { 'cf-icon': () => {} } } });
  await flushPromises();
  return { ...env, wrapper, async dispose() { wrapper.unmount(); await env.dispose(); } };
}

it('excludes sample messages and contributors from Twitch history even while disconnected', async () => {
  const env = await fixture();
  try {
    expect(env.store.state!.contributors).toHaveLength(48);
    expect(env.store.state!.chat.length).toBeGreaterThan(0);
    expect(env.wrapper.findAll('.cf-chat-message')).toHaveLength(0);
    expect(env.wrapper.get('.cf-chat-people').text()).toBe('0 contributors');
    expect(env.wrapper.find('.cf-empty-state').exists()).toBe(true);
    expect(env.wrapper.get('.cf-chat-session-start').text()).toBe('Twitch history');
  } finally { await env.dispose(); }
});

it('counts Twitch contributors and filters examples before applying the history limit', async () => {
  const env = await fixture();
  try {
    const state = env.store.state!;
    state.runtime.twitch = { ...disconnectedTwitch(), phase: 'connected', canChat: true };
    state.contributors.push({ id: 'twitch:99', name: 'Real viewer', color: 'green', joinedAt: new Date().toISOString() });
    state.chat.unshift({ id: 'real-message', userId: 'twitch:99', username: 'Real viewer', text: 'Real channel conversation', source: 'twitch', kind: 'message', createdAt: new Date().toISOString() });
    const sample = state.chat.at(-1)!;
    state.chat.push(...Array.from({ length: 101 }, (_, index) => ({ ...sample, id: `extra-sample-${index}` })));
    await flushPromises();
    expect(env.wrapper.get('.cf-chat-messages').text()).toContain('Real channel conversation');
    expect(env.wrapper.get('.cf-chat-messages').text()).not.toContain(sample.text);
    expect(env.wrapper.get('.cf-chat-people').text()).toBe('1 contributors');
    expect(env.wrapper.find('.cf-empty-state').exists()).toBe(false);
  } finally { await env.dispose(); }
});

it('shows examples only during an explicit local test and keeps the draft and stored history', async () => {
  const env = await fixture();
  try {
    const before = env.studio.state();
    const writes = env.storage.saves;
    env.store.chatDraft.text = 'Unsent draft';
    const testButton = env.wrapper.findAll('button').find(button => button.text() === 'Test commands locally');
    if (!testButton) throw new Error('Missing local test action');
    await testButton.trigger('click');
    expect(env.wrapper.get('.cf-chat-messages').text()).toContain(before.chat[0]!.text);
    expect(env.wrapper.get('.cf-chat-session-start').text()).toBe('Local test history');
    expect(env.wrapper.get('.cf-chat-people').text()).toBe('48 contributors');
    const endButton = env.wrapper.findAll('button').find(button => button.text() === 'End local test');
    if (!endButton) throw new Error('Missing end local test action');
    await endButton.trigger('click');
    expect(env.wrapper.find('.cf-empty-state').exists()).toBe(true);
    expect(env.wrapper.get('.cf-chat-people').text()).toBe('0 contributors');
    expect(env.store.chatDraft.text).toBe('Unsent draft');
    expect(env.storage.saves).toBe(writes);
    expect(env.studio.state()).toEqual(before);
  } finally { await env.dispose(); }
});
