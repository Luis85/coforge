// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { expect, it } from 'vitest';
import { useIdeaCardMenu } from '../../../presentation/composables/coforge/use-idea-card-menu';
import { createSeed } from '../../../features/coforge/domain/seed';
import { definition } from './configured-workflow-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

it('offers Stop while waiting, returns the card to Inbox, and only offers explicit Restart afterward', async () => {
  const f = await workflowUiFixture();
  const idea = createSeed().ideas.find(item => item.status === 'inbox')!;
  await f.studio.store.transaction(state => {
    state.ideas = [{ ...idea, projectId: f.project.id }];
    state.settings.workflow = definition([{ id: 'consent', name: 'Human decision', kind: 'approval', instructions: 'Review first.' }]);
  });
  await f.studio.startWorkflow(idea.id);
  let menu: ReturnType<typeof useIdeaCardMenu> | undefined;
  const Probe = defineComponent({ setup() {
    menu = useIdeaCardMenu({ get idea() { return f.store.state!.ideas[0]!; } }, { voted: false, voteDisabled: false, vote() {} });
    return () => h('div');
  } });
  const wrapper = mount(Probe, { global: { plugins: [f.pinia, f.provider] } });
  const select = (label: string) => {
    menu!.contextChanged(true);
    const item = menu!.items.flat().find(item => item.label === label);
    expect(item, label).toBeDefined(); expect(item?.disabled).toBeFalsy();
    const handler = item && Reflect.get(item, 'onSelect'); if (typeof handler === 'function') handler(new Event('select'));
  };
  try {
    select('Stop workflow'); await flushPromises();
    expect(f.studio.state().ideas[0]?.status).toBe('inbox');
    expect(f.studio.state().workflowStopHolds).toContain(idea.id);
    expect(menu!.items.flat().some(item => item.label?.startsWith('Run ·'))).toBe(false);
    const stoppedId = f.studio.state().ideas[0]?.workflowRun?.id;
    select('Restart workflow'); await flushPromises();
    expect(f.studio.state().workflowStopHolds).not.toContain(idea.id);
    expect(f.studio.state().ideas[0]?.workflowRun?.id).not.toBe(stoppedId);
    expect(f.studio.state().ideas[0]?.workflowHistory?.[0]?.id).toBe(stoppedId);
    expect(f.studio.state().ideas[0]?.workflowRun?.attempts[0]?.stepId).toBe('consent');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
