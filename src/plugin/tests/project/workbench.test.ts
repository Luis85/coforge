// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import Workbench from "../../generated/presentation/components/ProjectWorkbench.vue";
import { panels } from "../../generated/bootstrap/panels.ts";
import { projectKey } from "../../generated/presentation/context/project.ts";
it('mounts the generated product screens with isolated view state', async () => { const pinia = createPinia(); const wrapper = mount(Workbench,{global:{plugins:[pinia],provide:{[projectKey as symbol]:{panels,flows:[],isolated:false,openModal:()=>{}}}}}); try { expect(wrapper.find('h2').exists()).toBe(true); for (const button of wrapper.findAll('nav button').filter(b => b.text() !== 'Back')) { await button.trigger('click'); expect(wrapper.find('h2').text()).toBe(button.text()); } } finally { wrapper.unmount(); disposePinia(pinia); } });
