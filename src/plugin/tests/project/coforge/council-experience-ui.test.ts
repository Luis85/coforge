// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { councilAskFixture, askButton, visitCouncilPage } from './council-ask-fixture';

it('selects a Council directly and shows its recipients before saving or dispatching', async () => {
  const f = await councilAskFixture();
  try {
    const composer = f.wrapper.get('[aria-label="Ask the Council for advice"]');
    expect(composer.findAll('select')).toHaveLength(1);
    await composer.get('input').setValue('A decision');
    await composer.get('textarea').setValue('Compare our options.');
    await composer.get('select').setValue('advice');
    const recipients = f.wrapper.get('[aria-label="Selected Council recipients"]');
    expect(recipients.text()).toContain('Advice Council');
    expect(recipients.text()).toContain('claude');
    expect(recipients.text()).toContain('Opinions');
    expect(askButton(f.wrapper, 'Save task and review').attributes('disabled')).toBeUndefined();
    await composer.get('form').trigger('submit'); await flushPromises();
    expect((await f.module.actions.listTasks())[0]?.target).toEqual({ kind: 'council', id: 'advice', teamId: 'team' });
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { await f.dispose(); }
});

it('exposes every Council page without a disclosure and keeps a question through setup navigation', async () => {
  const f = await councilAskFixture();
  try {
    f.ui.taskQuestion = 'Keep this draft';
    const navigation = f.wrapper.get('nav[aria-label="Council tasks"]');
    expect(navigation.findAll('button')).toHaveLength(4);
    expect(f.wrapper.find('.cf-council-advanced').exists()).toBe(false);
    await visitCouncilPage(f.wrapper, 'Definitions');
    await visitCouncilPage(f.wrapper, 'Ask the Council');
    expect(f.ui.taskQuestion).toBe('Keep this draft');
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
    expect(f.wrapper.get('[aria-label="Council activity"]').text()).toContain('Execution paused');
  } finally { await f.dispose(); }
});

it('blocks a stale selection when the owning team becomes unavailable', async () => {
  const f = await councilAskFixture();
  try {
    await f.fill();
    const catalogue = await f.module.actions.catalogue.list();
    const team = catalogue.valid.find(entry => entry.definition.id === 'team')!;
    await f.module.actions.catalogue.save({ ...team.definition, enabled: false }, team.revision);
    await askButton(f.wrapper, 'Refresh Council').trigger('click'); await flushPromises();
    expect(askButton(f.wrapper, 'Save task and review').attributes('disabled')).toBeDefined();
    expect(f.wrapper.get('[aria-label="Selected Council recipients"]').text()).toContain('unavailable');
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
  } finally { await f.dispose(); }
});
