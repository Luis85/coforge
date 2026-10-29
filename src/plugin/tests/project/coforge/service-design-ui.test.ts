// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Plugin as VuePlugin } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, Plugin, parseYaml } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import ServiceDesignView from '../../../presentation/components/coforge/ServiceDesignView.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { ServiceDesign } from '../../../features/service-design/application/service-design';
import { VaultServiceDesign } from '../../../infrastructure/coforge/vault-service-design';
import { splitNote } from '../../../infrastructure/coforge/markdown';
import { workflowUiFixture } from './workflow-ui-fixture';

afterEach(() => { document.body.replaceChildren(); });

async function fixture() {
  const studio = await workflowUiFixture();
  const app = new App();
  const vault = createTestApp({ app, files: {}, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const repository = new VaultServiceDesign(plugin, () => ({ ideasFolder: 'CoForge/Ideas', publicFolder: 'CoForge/Public' }), () => []);
  let sequence = 0;
  const service = new ServiceDesign(repository, () => `sd-ui-${++sequence}`, id => Boolean(studio.studio.state().projects?.some(project => project.id === id)));
  const context: CoforgeContext = {
    studio: studio.studio, startupError: () => null, onNotice: () => () => {},
    host: { serviceDesign: service, setSecret: () => false, hasSecret: () => false,
      openIdeaNote: async () => false, saveExport: async () => '',
      publishBoard: async () => ({ folder: '', changed: false }),
      installPagesWorkflow: async () => ({ folder: '', workflow: '', created: false }) },
  };
  const provider: VuePlugin = { install: vue => { vue.provide(coforgeKey, context); } };
  const render = () => mount(ServiceDesignView, { attachTo: document.body, global: { plugins: [studio.pinia, provider], stubs: { CfIcon: true } } });
  return { ...studio, app, vault, service, render };
}
async function click(wrapper: VueWrapper, title: string) {
  const button = wrapper.findAll('button').find(item => item.text().trim() === title || item.attributes('aria-label') === title);
  if (!button) throw new Error(`Missing button: ${title}`);
  await button.trigger('click');
  await flushPromises();
}
function field(wrapper: VueWrapper, label: string) {
  const control = wrapper.findAll('label').find(item => item.find('span').exists() && item.find('span').text() === label);
  if (!control) throw new Error(`Missing field: ${label}`);
  return control.get('input, select, textarea');
}
async function save(wrapper: VueWrapper, title: string, body = '') {
  await field(wrapper, 'Entity title').setValue(title);
  await field(wrapper, 'Markdown notes').setValue(body);
  await wrapper.get('form[aria-label="Service Design entity editor"]').trigger('submit');
  await flushPromises();
}
async function add(wrapper: VueWrapper, kind: string, title: string) {
  await field(wrapper, 'New entity type').setValue(kind);
  await click(wrapper, 'Add entity');
  await save(wrapper, title);
}

describe('Service Design workspace', () => {
  it('creates canonical blueprint, ordered journey step and linked layer notes through the editor', async () => {
    const kit = await fixture();
    const wrapper = kit.render();
    try {
      await flushPromises();
      await click(wrapper, 'Create service blueprint');
      expect(document.activeElement).toBe(field(wrapper, 'Entity title').element);
      await save(wrapper, 'Community onboarding', '# Service goal\nHelp newcomers join the community.\n');
      await add(wrapper, 'journey-step', 'Join community');
      const step = (await kit.service.load()).notes.find(note => note.kind === 'journey-step')!;
      await add(wrapper, 'journey-step', 'Discover service');
      const moved = (await kit.service.load()).notes.find(note => note.title === 'Discover service')!;
      await field(wrapper, 'Order').setValue(0);
      await wrapper.get('form[aria-label="Service Design entity editor"]').trigger('submit'); await flushPromises();
      expect(wrapper.findAll('.cf-blueprint-grid thead th button strong').map(item => item.text())).toEqual(['Discover service', 'Join community']);
      expect((await kit.service.load()).notes.find(note => note.title === 'Discover service')?.id).toBe(moved.id);
      await field(wrapper, 'New entity type').setValue('customer-action');
      await click(wrapper, 'Add entity');
      await field(wrapper, 'Journey step').setValue(step.id);
      await wrapper.get(`.cf-blueprint-links input[value="${step.id}"]`).setValue(true);
      await field(wrapper, 'Find related entities').setValue('Community onboarding');
      expect(wrapper.find(`.cf-blueprint-links input[value="${step.id}"]`).exists()).toBe(false);
      const body = 'Complete the **registration** form.\n\nKeep authored details.';
      await save(wrapper, 'Register account', body);
      const action = (await kit.service.load()).notes.find(note => note.kind === 'customer-action')!;
      const saved = splitNote(kit.vault.read(action.path));
      expect(saved.body).toBe(body);
      expect(parseYaml(saved.yaml!)).toMatchObject({ kind: 'customer-action', project_id: kit.project.id, step_id: step.id, step: `[[${step.path.slice(0, -3)}]]`, related: [`[[${step.path.slice(0, -3)}]]`] });
      expect(wrapper.text()).toContain('Register account');
      expect(wrapper.text()).toContain('Frontstage action');
      expect(wrapper.text()).toContain('Backstage action');
      expect(wrapper.text()).toContain('Support process');
      expect(wrapper.text()).toContain('Physical / digital evidence');
      const overview = wrapper.get('[aria-label="Service blueprint overview"]').text();
      await field(wrapper, 'Find entities').setValue('No matching service entity');
      expect(wrapper.get('[aria-label="Service blueprint overview"]').text()).toBe(overview);
      expect(wrapper.get('[aria-label="Service Design entities"]').text()).toContain('No matching entities');
      for (const kind of ['frontstage-action', 'backstage-action', 'support-process', 'evidence', 'actor', 'touchpoint', 'system', 'pain-point', 'opportunity']) {
        await field(wrapper, 'New entity type').setValue(kind);
        await click(wrapper, 'Add entity');
        await field(wrapper, 'Journey step').setValue(step.id);
        await save(wrapper, `${kind} detail`);
      }
      const createdKinds = new Set((await kit.service.load()).notes.map(note => note.kind));
      expect([...createdKinds].sort()).toEqual(['actor', 'backstage-action', 'blueprint', 'customer-action', 'evidence', 'frontstage-action', 'journey-step', 'opportunity', 'pain-point', 'support-process', 'system', 'touchpoint']);
      expect(kit.runner).not.toHaveBeenCalled();
    } finally { wrapper.unmount(); await kit.dispose(); }
  });

  it('retains separate project drafts across switching and remount, and guards replacement', async () => {
    const kit = await fixture();
    const first = kit.project;
    const second = await kit.studio.createProject({ projectName: 'Another service', projectBrief: 'Separate service', projectPath: '/synthetic/second-service' });
    await kit.studio.selectProject(first.id);
    let wrapper = kit.render();
    try {
      await flushPromises(); await click(wrapper, 'Create service blueprint');
      await field(wrapper, 'Entity title').setValue('First unsaved blueprint');
      await kit.studio.selectProject(second.id); await flushPromises();
      await click(wrapper, 'Create service blueprint');
      await field(wrapper, 'Entity title').setValue('Second unsaved blueprint');
      await kit.studio.selectProject(first.id); await flushPromises();
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'First unsaved blueprint');
      wrapper.unmount(); wrapper = kit.render(); await flushPromises();
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'First unsaved blueprint');
      await click(wrapper, 'Create service blueprint');
      expect(document.activeElement).toBe(wrapper.get('[aria-label="Unsaved entity draft"]').element);
      await click(wrapper, 'Keep editing');
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'First unsaved blueprint');
      await click(wrapper, 'Create service blueprint');
      await click(wrapper, 'Discard draft and continue');
      expect(document.activeElement).toBe(field(wrapper, 'Entity title').element);
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', '');
      await kit.studio.selectProject(second.id); await flushPromises();
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'Second unsaved blueprint');
      expect(kit.app.vault.getMarkdownFiles()).toHaveLength(0);
    } finally { wrapper.unmount(); await kit.dispose(); }
  });

  it('keeps a stale edit visible, leaves external bytes untouched, and requires deliberate reopening after refresh', async () => {
    const kit = await fixture();
    const note = await kit.service.save(kit.project.id, { kind: 'blueprint', title: 'Saved blueprint', body: 'Original body.', stepId: '', links: [], order: 0 });
    const wrapper = kit.render();
    try {
      await flushPromises(); await click(wrapper, 'Edit blueprint');
      await field(wrapper, 'Entity title').setValue('My retained edit');
      const file = kit.app.vault.getFileByPath(note.path)!;
      await kit.app.vault.process(file, current => current + '\nExternal work.');
      const exact = kit.vault.read(note.path);
      await wrapper.get('form[aria-label="Service Design entity editor"]').trigger('submit'); await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain('Refresh');
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'My retained edit');
      expect(kit.vault.read(note.path)).toBe(exact);
      await click(wrapper, 'Refresh blueprint');
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'My retained edit');
      await click(wrapper, 'Edit blueprint'); await click(wrapper, 'Discard draft and continue');
      expect(field(wrapper, 'Markdown notes').element).toHaveProperty('value', 'Original body.\nExternal work.');
      expect(kit.vault.read(note.path)).toBe(exact);
    } finally { wrapper.unmount(); await kit.dispose(); }
  });

  it('finishes a pending save in its captured project while another project keeps its draft', async () => {
    const kit = await fixture();
    const first = kit.project;
    const second = await kit.studio.createProject({ projectName: 'Parallel service', projectBrief: 'Second draft', projectPath: '/synthetic/parallel-service' });
    const wrapper = kit.render();
    let release = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    const original = kit.service.save.bind(kit.service);
    try {
      await flushPromises(); await click(wrapper, 'Create service blueprint');
      await field(wrapper, 'Entity title').setValue('Second retained draft');
      await kit.studio.selectProject(first.id); await flushPromises();
      await click(wrapper, 'Create service blueprint');
      await field(wrapper, 'Entity title').setValue('First captured save');
      const saveAttempt = vi.spyOn(kit.service, 'save').mockImplementationOnce(async (projectId, input) => {
        await pending;
        return original(projectId, input);
      });
      await wrapper.get('form[aria-label="Service Design entity editor"]').trigger('submit');
      await kit.studio.selectProject(second.id); await flushPromises();
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'Second retained draft');
      release(); await flushPromises();
      expect(saveAttempt).toHaveBeenCalledWith(first.id, expect.objectContaining({ title: 'First captured save' }));
      expect((await kit.service.load()).notes).toEqual([expect.objectContaining({ projectId: first.id, title: 'First captured save' })]);
      expect(field(wrapper, 'Entity title').element).toHaveProperty('value', 'Second retained draft');
      saveAttempt.mockRestore();
    } finally { release(); wrapper.unmount(); await kit.dispose(); }
  });
});
