// @vitest-environment happy-dom
import { mount, flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import CouncilView from '../../../presentation/components/coforge/CouncilView.vue';
import { coforgeKey } from '../../../presentation/context/coforge-context';
import { councilAskFixture } from './council-ask-fixture';

it('follows the first loaded project when mounted before project state is available', async () => {
  const f = await councilAskFixture(); f.wrapper.unmount();
  f.studioUi.state = null; f.ui.runScopeInitialized = false; f.ui.projectFilter = '';
  const wrapper = mount(CouncilView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(f.ui.projectFilter).toBe('');
    f.studioUi.state = f.studio.state(); await flushPromises();
    expect(f.ui.projectFilter).toBe(f.projectId);
  } finally { wrapper.unmount(); await f.dispose(false); }
});

it('preserves an explicit foreign-project entry when the current project first loads', async () => {
  const f = await councilAskFixture(); f.wrapper.unmount();
  f.studioUi.state = null; f.ui.runScopeInitialized = false; f.ui.projectFilter = '';
  f.ui.entryIntent = { page: 'monitor', runId: 'historical-run', projectId: 'foreign-project', navigationRevision: f.studioUi.navigationRevision };
  const wrapper = mount(CouncilView, { global: { plugins: [f.pinia], provide: { [coforgeKey as symbol]: f.context }, directives: { 'cf-icon': () => {} } } });
  try {
    await flushPromises();
    expect(f.ui.tab).toBe('monitor'); expect(f.ui.projectFilter).toBe('foreign-project');
    f.studioUi.state = f.studio.state(); await flushPromises();
    expect(f.ui.projectFilter).toBe('foreign-project'); expect(f.ui.inspectedRun).toBe('historical-run');
  } finally { wrapper.unmount(); await f.dispose(false); }
});
