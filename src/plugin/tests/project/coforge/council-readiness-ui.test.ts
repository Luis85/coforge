// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import type { CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import { councilAskFixture, askButton, visitCouncilPage } from './council-ask-fixture';

it('does not show another project answers when opening activity in an empty project', async () => {
  const f = await councilAskFixture();
  try {
    const run = await f.module.actions.simulate(f.target, 'Private/Proposal.md', 'CoForge/Tests/Other-project.md');
    f.ui.inspectedRun = run.id;
    const project = await f.studio.createProject({ projectName: 'Empty project', projectBrief: 'An independent project.', projectPath: '/synthetic/empty' });
    await f.studio.selectProject(project.id); await flushPromises();
    await askButton(f.wrapper, 'View activity').trigger('click'); await flushPromises();
    expect(f.ui.projectFilter).toBe(project.id); expect(f.ui.inspectedRun).toBe('');
    expect(f.wrapper.find('[aria-label="Council answers"]').exists()).toBe(false);
    expect(f.wrapper.find('[aria-label="Captured run evidence"]').exists()).toBe(false);
    expect(f.module.actions.snapshot().runs[0]?.id).toBe(run.id);
  } finally { await f.dispose(); }
});

it('keeps readiness loading or unavailable until a successful list and preserves an authored draft', async () => {
  const f = await councilAskFixture();
  try {
    await visitCouncilPage(f.wrapper, 'Definitions');
    const definition = f.wrapper.get('.cf-council-definition-list').findAll('button').find(button => button.text().includes('Advice Council'))!;
    await definition.trigger('click'); await flushPromises();
    await f.wrapper.get('input[aria-label="Definition name"]').setValue('Preserved Council draft');
    const original = f.module.actions.catalogue.list.bind(f.module.actions.catalogue);
    let release: ((snapshot: CouncilCatalogueSnapshot) => void) | undefined;
    const list = vi.spyOn(f.module.actions.catalogue, 'list').mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    const readiness = f.wrapper.get('[aria-label="Council setup readiness"]');
    expect(readiness.text()).toContain('Loading Council configuration');
    expect(readiness.text()).not.toContain('No enabled CoWorkers');
    expect(askButton(f.wrapper, 'Create team').attributes('disabled')).toBeDefined();
    release?.(await original()); await flushPromises();
    expect(readiness.text()).toContain('1 configured Council');
    list.mockRejectedValueOnce(new Error('Vault listing unavailable'));
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    expect(readiness.text()).toContain('Configuration unavailable');
    expect(readiness.text()).not.toContain('No project roster');
    expect(askButton(f.wrapper, 'Create team').attributes('disabled')).toBeDefined();
    expect(askButton(f.wrapper, 'Create council').attributes('disabled')).toBeDefined();
    expect(f.wrapper.get('input[aria-label="Definition name"]').element).toHaveProperty('value', 'Preserved Council draft');
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    expect(readiness.text()).toContain('1 configured Council');
  } finally { await f.dispose(); }
});

it('never describes a pending or failed first catalogue read as empty saved definitions', async () => {
  const f = await councilAskFixture();
  try {
    let reject: ((reason: Error) => void) | undefined;
    vi.spyOn(f.module.actions.catalogue, 'list').mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await visitCouncilPage(f.wrapper, 'Definitions');
    const saved = f.wrapper.get('nav[aria-label="Saved definitions"]');
    expect(saved.text()).toContain('Loading saved definitions');
    expect(saved.text()).not.toContain('No definitions yet');
    expect(saved.text()).not.toContain('No matching definitions');
    reject?.(new Error('Catalogue unavailable')); await flushPromises();
    expect(saved.text()).toContain('Saved definitions are unavailable');
    expect(saved.text()).not.toContain('No definitions yet');
    await askButton(f.wrapper, 'Refresh definitions').trigger('click'); await flushPromises();
    expect(saved.text()).toContain('Advice Council');
  } finally { await f.dispose(); }
});
