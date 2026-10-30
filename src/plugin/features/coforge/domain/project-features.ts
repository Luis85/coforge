import { list, oneOf } from './check';
import { visibleProjectGroups } from './project-feature-groups';
import type { StudioProject } from './types';

/** Standalone workspace capabilities; internal tabs belong to their owning feature. */
export const PROJECT_FEATURES = [
  { id: 'board', group: 'build', label: 'Idea board', description: 'Collect, prioritize and review project requests.' },
  { id: 'council', group: 'build', label: 'The Council', description: 'Ask councils for advice and inspect their contributions.' },
  { id: 'coworkers', group: 'build', label: 'CoWorkers', description: 'Manage the vault’s reusable agents and definitions.' },
  { id: 'service-design', group: 'build', label: 'Service Design', description: 'Build this project’s service blueprint and linked notes.' },
  { id: 'workflow', group: 'build', label: 'Agent workflow', description: 'Configure and follow project runs, templates and Herdr workspaces.' },
  { id: 'broadcast', group: 'stream', label: 'Stream studio', description: 'Operate OBS, scenes, show plans and public displays.' },
  { id: 'alerts', group: 'stream', label: 'Alerts', description: 'Manage viewer-facing alerts and the OBS Alerts URL.' },
  { id: 'schedule', group: 'stream', label: 'Schedule', description: 'Plan and explicitly prepare upcoming streams.' },
  { id: 'stream', group: 'stream', label: 'Stream chat', description: 'Open channel chat, bot messages and the board’s chat panel.' },
  { id: 'twitch-operations', group: 'stream', label: 'Twitch operations', description: 'Manage supported live channel and community interactions.' },
  { id: 'community', group: 'community', label: 'Community', description: 'View shared contributor recognition, ranks and badges.' },
  { id: 'population', group: 'community', label: 'Viewers', description: 'Inspect registered and observed channel viewers.' },
  { id: 'economy', group: 'community', label: 'Economy', description: 'Manage currency, command prices, rewards and fulfillment.' },
  { id: 'community-settings', group: 'community', label: 'Community settings', description: 'Configure shared community names, XP, reputation and ranks.' },
  { id: 'statistics', group: 'insights', label: 'Statistics', description: 'Compare recorded stream audience, engagement and OBS metrics.' },
  { id: 'ai-costs', group: 'insights', label: 'AI costs', description: 'Inspect private agent usage and costs across vault projects.' },
  { id: 'finance', group: 'insights', label: 'Finances', description: 'Maintain the private stream income and expense ledger.' },
  { id: 'operations', group: 'insights', label: 'Operations', description: 'Inspect private operational activity and outcomes.' },
] as const;
export type ProjectFeature = typeof PROJECT_FEATURES[number]['id'];
const FEATURE_IDS = PROJECT_FEATURES.map(feature => feature.id);

export const isProjectFeature = (value: string): value is ProjectFeature =>
  PROJECT_FEATURES.some(feature => feature.id === value);
export function projectFeaturesCheck(value: unknown): ProjectFeature[] {
  const selected = list(oneOf(FEATURE_IDS), { max: FEATURE_IDS.length })(value);
  return FEATURE_IDS.filter(id => selected.includes(id));
}
/** Missing preferences keep legacy capabilities; [] explicitly selects none. */
export const visibleProjectFeatures = (project?: Pick<StudioProject, 'features'>): readonly ProjectFeature[] =>
  project?.features ?? FEATURE_IDS;
export const projectFeatureEnabled = (project: StudioProject | undefined, id: ProjectFeature): boolean =>
  visibleProjectFeatures(project).includes(id) && PROJECT_FEATURES.some(feature =>
    feature.id === id && visibleProjectGroups(project).includes(feature.group));
