// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { expect, it, vi } from 'vitest';
import PluginSettingsMcp from '../../../presentation/components/coforge/PluginSettingsMcp.vue';
import { coforgeKey, type CoforgeContext } from '../../../presentation/context/coforge-context';
import { useStudioStore } from '../../../presentation/stores/coforge-studio';
import { StudioService } from '../../../features/coforge/application/studio';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { createSeed } from '../../../features/coforge/domain/seed';

it('activates the vault once, displays failures and permits deactivation and explicit recovery', async () => {
  const studio = new StudioService(new MemoryStorage(createSeed()), { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.updateProject({ projectPath: '/game' });
  let active = false;
  let recovered = false;
  const activate = vi.fn(async () => { if (activate.mock.calls.length === 1) throw new Error('Malformed MCP settings. Repair the JSON and retry.'); active = true; });
  const deactivate = vi.fn(async () => { active = false; });
  const recover = vi.fn(async () => { recovered = true; });
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => {}, host: {
    mcp: { status: () => ({ active, recovery: active && !recovered ? [{ projectId: 'CFP-001', taskId: 'interrupted', ideaId: 'CF-101', step: 'Build' }] : [], message: active ? 'Active while CoForge is open.' : 'Inactive.' }), activate, deactivate, recover },
    setSecret: () => false, hasSecret: () => false, openIdeaNote: async () => false, saveExport: async () => '', publishBoard: async () => ({ folder: '', changed: false }), installPagesWorkflow: async () => ({ workflow: '', folder: '', created: false }),
  } };
  const pinia = createPinia();
  useStudioStore(pinia).state = studio.state();
  const wrapper = mount(PluginSettingsMcp, { global: { plugins: [pinia], provide: { [coforgeKey as symbol]: context } } });
  try {
    const button = wrapper.findAll('button').find(button => button.text() === 'Activate MCP')!;
    await button.trigger('click'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Repair the JSON');
    expect(wrapper.text()).toContain('Internet research is allowed');
    expect(wrapper.text()).toContain('normal desktop connectivity');
    expect(wrapper.find('select').exists()).toBe(false);
    await button.trigger('click'); await flushPromises(); expect(wrapper.text()).toContain('Active while CoForge');
    expect(activate).toHaveBeenLastCalledWith();
    const acknowledge = wrapper.findAll('button').find(button => button.text() === 'Acknowledge recovery')!;
    expect(acknowledge.attributes('disabled')).toBeDefined();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await acknowledge.trigger('click'); await flushPromises();
    expect(recover).toHaveBeenCalledWith('interrupted');
    await wrapper.findAll('button').find(button => button.text() === 'Deactivate MCP')!.trigger('click'); await flushPromises();
    expect(deactivate).toHaveBeenCalledWith();
  } finally { wrapper.unmount(); disposePinia(pinia); await studio.stop(); }
});
