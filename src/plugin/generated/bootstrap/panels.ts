import StudioApp from '../../presentation/components/coforge/StudioApp.vue';
import PluginSettings from '../../presentation/components/coforge/PluginSettings.vue';
import type { Component } from 'vue';
// The workspace view hosts the CoForge studio; the settings tab hosts its integration settings.
export const panels: Record<string,Component> = {"node-1": StudioApp,
"node-2": PluginSettings};
