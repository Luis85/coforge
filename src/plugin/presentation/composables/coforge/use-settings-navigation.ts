import { computed, reactive } from 'vue';
import { SETTINGS_PAGES, type SettingsPage } from '../../stores/studio-pages';
import type { SettingsModel } from './use-settings';

const details: Record<SettingsPage, { icon: string; description: string }> = {
  general: { icon: 'sliders-horizontal', description: 'Identity, visibility and instructions' },
  requests: { icon: 'list-filter', description: 'Categories and note properties' },
  repository: { icon: 'folder-git-2', description: 'Workspace and build permission' },
  workflow: { icon: 'workflow', description: 'Runs, steps and AI providers' },
  runtime: { icon: 'plug', description: 'Observed local connections' },
  data: { icon: 'database', description: 'Private backups and sample tools' },
};

/** Local settings tasks share one protected project draft. */
export function useSettingsNavigation(model: SettingsModel) {
  return reactive({
    items: SETTINGS_PAGES.map(item => ({ ...item, ...details[item.id] })),
    formPage: computed(() => ['general', 'requests', 'repository'].includes(model.store.settingsTool)),
    formId: `${model.store.layoutId}-project-settings-form`,
    select: (page: SettingsPage) => model.store.openSettingsTool(page),
  });
}
