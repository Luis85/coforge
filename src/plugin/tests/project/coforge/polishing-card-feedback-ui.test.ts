// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import IdeaCard from '../../../presentation/components/coforge/IdeaCard.vue';
import { polishingCardFixture } from './polishing-card-fixture';
import { workflowUiFixture } from './workflow-ui-fixture';

it('reactively shows polishing independently of the old Build attention state and keeps card navigation available', async () => {
  const f = await workflowUiFixture(); const saved = polishingCardFixture();
  if (!f.store.state) throw new Error('Missing UI state');
  f.store.state.ideas = [saved.idea]; f.store.state.jobs = [saved.job];
  const idea = f.store.state.ideas[0]!; const pass = idea.polishingRuns![0]!;
  const before = JSON.stringify(idea);
  const wrapper = mount(IdeaCard, { props: { idea }, global: { plugins: [f.pinia, f.provider],
    stubs: { UContextMenu: { inheritAttrs: false, template: '<slot />' }, UDropdownMenu: { inheritAttrs: false, template: '<slot />' }, CfIcon: true, MarkdownBody: true } } });
  try {
    expect(wrapper.get('.cf-card-state:not(.cf-card-polishing-state)').text()).toBe('Run needs attention');
    expect(wrapper.get('[data-polishing-status="running"]').text()).toBe('Polishing in progress');
    expect(wrapper.get('[aria-label="Polishing status"]').attributes('role')).toBe('status');
    expect(wrapper.get('.cf-idea-open').attributes('disabled')).toBeUndefined();
    expect(JSON.stringify(idea)).toBe(before);
    await wrapper.get('.cf-idea-open').trigger('click');
    expect(f.store.selected).toBe(idea.id);
    pass.workflow.state = 'attention'; await flushPromises();
    expect(wrapper.get('[data-polishing-status="attention"]').text()).toBe('Polishing needs attention');
    pass.review = 'rejected'; await flushPromises();
    expect(wrapper.find('.cf-card-polishing-state').exists()).toBe(false);
    expect(wrapper.get('.cf-card-state').text()).toBe('Run needs attention');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});

it('keeps the active primary workflow label when an auxiliary job was inserted first', async () => {
  const f = await workflowUiFixture(); const saved = polishingCardFixture();
  if (!f.store.state || !saved.job.workflow) throw new Error('Missing UI state');
  f.store.state.ideas = [saved.idea]; f.store.state.jobs = [saved.job, { ...saved.job, id: 'main-job',
    workflow: { ...saved.job.workflow, runId: 'main-run', polishingId: undefined, step: { ...saved.job.workflow.step, name: 'Captured Build' } } }];
  const wrapper = mount(IdeaCard, { props: { idea: f.store.state.ideas[0]! }, global: { plugins: [f.pinia, f.provider],
    stubs: { UContextMenu: { inheritAttrs: false, template: '<slot />' }, UDropdownMenu: { inheritAttrs: false, template: '<slot />' }, CfIcon: true, MarkdownBody: true } } });
  try {
    expect(wrapper.get('.cf-card-state:not(.cf-card-polishing-state)').text()).toBe('Captured Build running');
    expect(wrapper.get('.cf-card-polishing-state').text()).toBe('Polishing in progress');
    delete f.store.state!.jobs[0]!.workflow!.polishingId; await flushPromises();
    expect(wrapper.get('.cf-card-state:not(.cf-card-polishing-state)').text()).toBe('Captured Build running');
    expect(wrapper.get('.cf-card-polishing-state').text()).toBe('Polishing · Checking execution');
    expect(f.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await f.dispose(); }
});
