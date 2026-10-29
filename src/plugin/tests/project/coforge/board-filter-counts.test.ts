// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { expect, it } from 'vitest';
import BoardToolbar from '../../../presentation/components/coforge/BoardToolbar.vue';
import { useIdeaBoard } from '../../../presentation/composables/coforge/use-board';
import { createSeed } from '../../../features/coforge/domain/seed';
import { workflowUiFixture } from './workflow-ui-fixture';

const Harness = defineComponent({ setup() { useIdeaBoard(); return () => h(BoardToolbar); } });
async function fixture() {
  const context = await workflowUiFixture();
  if (!context.store.state) throw new Error('Missing studio state');
  context.store.state.ideas = createSeed().ideas.map(idea => ({ ...idea, projectId: context.project.id }));
  const wrapper = mount(Harness, { global: { plugins: [context.pinia, context.provider], stubs: { CfIcon: true } } });
  return { ...context, wrapper, close: async () => { wrapper.unmount(); await context.dispose(); } };
}

it('counts only current-project requests in the existing filter tabs', async () => {
  const context = await fixture();
  try {
    const state = context.store.state;
    const idea = state?.ideas[0];
    if (!state || !idea) throw new Error('Missing request fixture');
    state.ideas = [
      { ...idea, id: 'CF-901', status: 'review' },
      { ...idea, id: 'CF-902', status: 'flagged' },
      { ...idea, id: 'CF-903', status: 'inbox' },
      { ...idea, id: 'CF-904', status: 'shipped' },
      { ...idea, id: 'CF-905', projectId: 'CFP-OTHER', status: 'review' },
    ];
    await nextTick();
    expect(context.wrapper.findAll('.cf-board-tab-count').map(item => item.text())).toEqual(['4', '1', '1', '0']);
  } finally { await context.close(); }
});

it('keeps filter counts empty while loading or when the selected project is unavailable', async () => {
  const context = await fixture();
  try {
    if (!context.store.state) throw new Error('Missing studio state');
    context.store.state.activeProjectId = 'CFP-MISSING';
    await nextTick();
    expect(context.wrapper.findAll('.cf-board-tab-count').map(item => item.text())).toEqual(['0', '0', '0', '0']);
    context.store.state = null;
    await nextTick();
    expect(context.wrapper.findAll('.cf-board-tab-count').map(item => item.text())).toEqual(['0', '0', '0', '0']);
  } finally { await context.close(); }
});

it('updates review counts from canonical request state without running or saving work', async () => {
  const context = await fixture();
  try {
    const state = context.store.state;
    const idea = state?.ideas[0];
    if (!state || !idea) throw new Error('Missing request fixture');
    const writes = context.storage.saves;
    state.ideas = [{ ...idea, status: 'review' }];
    await nextTick();
    expect(context.wrapper.findAll('.cf-board-tab-count')[1]?.text()).toBe('1');
    state.ideas = [{ ...idea, status: 'shipped' }];
    await nextTick();
    expect(context.wrapper.findAll('.cf-board-tab-count')[1]?.text()).toBe('0');
    expect(context.wrapper.findAll('.cf-board-tab-count')[0]?.text()).toBe('1');
    expect(context.storage.saves).toBe(writes);
    expect(context.runner).not.toHaveBeenCalled();
  } finally { await context.close(); }
});
