export type ConfigurationView = 'settings' | 'community-settings' | 'workflow-settings';
const LABELS: Record<ConfigurationView, string> = { settings: 'project settings', 'community-settings': 'community settings', 'workflow-settings': 'workflow settings' };
/** One draft guard is shared by navigation, project switching and scheduled project preparation. */
export function configurationProblem(dirty: Record<ConfigurationView, boolean>, next?: string): string {
  const views = ['settings', 'community-settings', 'workflow-settings'] as const;
  const current = views.find(view => dirty[view] && view !== next);
  return current ? `Save or discard your ${LABELS[current]} before ${next ? 'leaving' : 'switching projects'}.` : '';
}
