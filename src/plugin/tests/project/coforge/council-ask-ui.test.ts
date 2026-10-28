// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import CouncilView from '../../../presentation/components/coforge/CouncilView.vue';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { useCouncilStore } from '../../../presentation/stores/coforge-council';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { councilControlsFixture } from './council-controls-fixture';

it.each([true, false])('opens on advice intake and ingested history without writing or admitting work (executor: %s)', async executor => {
  const fixture = await councilControlsFixture(executor);
  const pinia = createPinia();
  useStudioStore(pinia).state = fixture.studio.state();
  const preflight = vi.spyOn(fixture.module.actions, 'preflight');
  const submit = vi.spyOn(fixture.module.actions, 'submit');
  const before = await Promise.all(fixture.app.vault.getMarkdownFiles().map(async file => [file.path, await fixture.app.vault.read(file)]));
  const context: CoforgeContext = {
    studio: fixture.studio, startupError: () => null, onNotice: () => () => {},
    host: { council: fixture.module.actions, setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => 'private-export.json', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }) },
  };
  const wrapper = mount(CouncilView, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(useCouncilStore(pinia).tab).toBe('ask');
    expect(wrapper.findAll('h2').map(heading => heading.text())).toContain('Ingested tasks');
    expect(wrapper.findAll('label').some(label => label.text().includes('Task title'))).toBe(true);
    expect(wrapper.findAll('label').some(label => label.text().includes('Your question or task'))).toBe(true);
    expect(wrapper.findAll('button').some(button => button.text().trim() === 'Save task and review')).toBe(true);
    expect(preflight).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled();
    expect(fixture.module.actions.snapshot().runs).toHaveLength(0);
    expect(await Promise.all(fixture.app.vault.getMarkdownFiles().map(async file => [file.path, await fixture.app.vault.read(file)]))).toEqual(before);
  } finally { wrapper.unmount(); disposePinia(pinia); await fixture.dispose(); }
});
