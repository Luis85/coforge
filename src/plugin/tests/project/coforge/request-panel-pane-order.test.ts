// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import { createSeed } from '../../../features/coforge/domain/seed';
import IdeaDrawer from '../../../presentation/components/coforge/IdeaDrawer.vue';
import type { IdeaDrawerTab } from '../../../presentation/composables/coforge/use-idea-drawer';
import { workflowUiFixture } from './workflow-ui-fixture';

async function fixture(tab: IdeaDrawerTab, withPlan = true) {
  const f = await workflowUiFixture();
  const idea = { ...createSeed().ideas.find(item => item.increment)!, projectId: f.project.id };
  if (!withPlan) delete idea.plan;
  f.store.state!.ideas = [idea];
  f.store.select(idea.id, tab);
  const writes = f.storage.saves;
  const wrapper = mount(IdeaDrawer, { global: { plugins: [f.pinia, f.provider], stubs: { CfIcon: true } } });
  await flushPromises();
  return { ...f, wrapper, writes, close: async () => { wrapper.unmount(); await f.dispose(); } };
}

it('leads Overview with the original request and keeps improvement feedback secondary without writing', async () => {
  const f = await fixture('overview');
  try {
    const headings = f.wrapper.findAll('.cf-idea-scroll h3').map(heading => heading.text());
    expect(headings[1]).toBe('Original request');
    expect(headings.indexOf('Improve this request')).toBeGreaterThan(headings.indexOf('Request screening'));
    expect(f.wrapper.get('[aria-label="Improve this request"]').text()).toContain('Review it before replacing');
    expect(f.storage.saves).toBe(f.writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it.each([true, false])('keeps plan and design independently discoverable when plan saved is %s', async withPlan => {
  const f = await fixture('plan', withPlan);
  try {
    const plan = f.wrapper.get('[aria-label="Implementation plan"]');
    const design = f.wrapper.get('[aria-label="Design specification"]');
    expect(plan.text()).toContain(withPlan ? 'Implementation plan' : 'No plan yet');
    expect(plan.text()).toContain(withPlan ? 'Copy Markdown' : 'Not saved');
    expect(design.text()).toContain('Design specification');
    expect(design.text()).toContain('Not saved');
    expect(design.find('button').exists()).toBe(true);
    expect(f.storage.saves).toBe(f.writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('puts the current workflow before follow-up improvement passes without starting work', async () => {
  const f = await fixture('workflow');
  try {
    const execution = f.wrapper.get('[aria-label="Request workflow execution"]');
    const improvements = f.wrapper.get('[aria-label="Improvement passes"]');
    expect(execution.element.compareDocumentPosition(improvements.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(execution.text()).toContain('Workflow progress');
    expect(f.storage.saves).toBe(f.writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('makes attempt transcripts discoverable before the request timeline without execution', async () => {
  const f = await fixture('activity');
  try {
    expect(f.wrapper.findAll('.cf-idea-scroll h3').map(heading => heading.text())).toEqual(['Activity', 'Agent runs', 'Request timeline']);
    expect(f.wrapper.text()).toContain('No agent runs yet.');
    expect(f.storage.saves).toBe(f.writes);
    expect(f.runner).not.toHaveBeenCalled();
  } finally { await f.close(); }
});
