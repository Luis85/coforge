import GWorkspace from '../presentation/components/screens/workspace-screen.vue';
import GPreferences from '../presentation/components/screens/preferences-screen.vue';
import type { Component } from 'vue';
export const panels: Record<string,Component> = {"node-1": GWorkspace,
"node-2": GPreferences};
