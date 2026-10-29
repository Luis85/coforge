// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import type { CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import { councilAskFixture, askButton, visitCouncilPage } from './council-ask-fixture';
import { useCouncilEditorStore } from '../../../presentation/stores/coforge-council-editor';

it.each([true, false])('handles a pending catalogue result after leaving through Ask and preserves its draft (success: %s)', async success => {
  const f = await councilAskFixture();
  try {
    await visitCouncilPage(f.wrapper, 'Definitions');
    const council = f.wrapper.get('.cf-council-definition-list').findAll('button').find(button => button.text().includes('Advice Council'))!;
    await council.trigger('click'); await flushPromises();
    await f.wrapper.get('input[aria-label="Definition name"]').setValue('Kept across pending read');
    const original = f.module.actions.catalogue.list.bind(f.module.actions.catalogue);
    let release: ((snapshot: CouncilCatalogueSnapshot) => void) | undefined;
    let reject: ((reason: Error) => void) | undefined;
    vi.spyOn(f.module.actions.catalogue, 'list').mockImplementationOnce(() => new Promise((resolve, fail) => { release = resolve; reject = fail; }));
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    await askButton(f.wrapper, 'Ask').trigger('click'); await flushPromises();
    await askButton(f.wrapper, 'Setup').trigger('click'); await flushPromises();
    expect(f.wrapper.get('[aria-label="Council setup readiness"]').text()).toContain('Loading Council configuration');
    if (success) release?.(await original());
    else reject?.(new Error('Catalogue read failed after navigation'));
    await flushPromises();
    if (!success) {
      expect(f.wrapper.get('[aria-label="Council setup readiness"]').text()).toContain('Configuration unavailable');
      expect(askButton(f.wrapper, 'Create council').attributes('disabled')).toBeDefined();
      expect(f.wrapper.get('input[aria-label="Definition name"]').element).toHaveProperty('value', 'Kept across pending read');
      await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    }
    expect(f.wrapper.get('[aria-label="Council setup readiness"]').text()).toContain('1 configured Council');
    expect(f.wrapper.get('.cf-council-definition-list').text()).toContain('Advice Council');
    expect(f.wrapper.get('input[aria-label="Definition name"]').element).toHaveProperty('value', 'Kept across pending read');
    expect(askButton(f.wrapper, 'Create council').attributes('disabled')).toBeUndefined();
  } finally { await f.dispose(); }
});

it('does not apply an old project load callback to another project and restores its unsaved draft later', async () => {
  const f = await councilAskFixture();
  try {
    const other = await f.studio.createProject({ projectName: 'Another project', projectBrief: 'Separate setup.', projectPath: '/synthetic/another' });
    await f.studio.selectProject(f.projectId); await flushPromises();
    await visitCouncilPage(f.wrapper, 'Definitions');
    const council = f.wrapper.get('.cf-council-definition-list').findAll('button').find(button => button.text().includes('Advice Council'))!;
    await council.trigger('click'); await flushPromises();
    await f.wrapper.get('input[aria-label="Definition name"]').setValue('First project draft');
    const original = f.module.actions.catalogue.list.bind(f.module.actions.catalogue);
    let release: ((snapshot: CouncilCatalogueSnapshot) => void) | undefined;
    vi.spyOn(f.module.actions.catalogue, 'list').mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    await f.studio.selectProject(other.id); await flushPromises();
    release?.(await original()); await flushPromises();
    const editor = useCouncilEditorStore();
    expect(editor.projectId).toBe(other.id); expect(editor.draft).toBeNull();
    expect(f.wrapper.get('.cf-council-definition-list').text()).not.toContain('Advice Council');
    await f.studio.selectProject(f.projectId); await flushPromises();
    expect(f.wrapper.get('input[aria-label="Definition name"]').element).toHaveProperty('value', 'First project draft');
  } finally { await f.dispose(); }
});
