// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import Workbench from "../../generated/presentation/components/ProjectWorkbench.vue";
import { panels } from "../../generated/bootstrap/panels.ts";
import { projectKey } from "../../generated/presentation/context/project.ts";
import { coforgeKey, type CoforgeContext } from "../../presentation/context/coforge-context.ts";
import { createDemoRunner } from "../../features/coforge/application/demo-agent.ts";
import { StudioService } from "../../features/coforge/application/studio.ts";
import { MemoryStorage, nodeTimers } from "./coforge/memory-storage.ts";

it('mounts the CoForge studio as the workspace screen with isolated view state', async () => {
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(new MemoryStorage(), { runners: { demo: runner, claude: runner }, timers, probeRuntime: () => Promise.resolve({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  const context: CoforgeContext = { studio, startupError: () => null, onNotice: () => () => undefined,
    host: { setSecret: () => false, hasSecret: () => false, openIdeaNote: () => Promise.resolve(false), saveExport: () => Promise.resolve(''),
      publishBoard: () => Promise.resolve({ folder: 'CoForge/Public', changed: true }), installPagesWorkflow: () => Promise.resolve({ workflow: '', folder: '', created: true }) } };
  const pinia = createPinia();
  const wrapper = mount(Workbench, { global: { plugins: [pinia], directives: { 'cf-icon': {} },
    provide: { [projectKey as symbol]: { panels, flows: [], isolated: false, openModal: () => {} }, [coforgeKey as symbol]: context } } });
  try {
    await flushPromises();
    expect(wrapper.find('nav[aria-label="Project navigation"]').exists()).toBe(false);
    expect(wrapper.find('.cf-studio .cf-sidebar').exists()).toBe(true);
  } finally { wrapper.unmount(); disposePinia(pinia); await studio.stop(); }
});
