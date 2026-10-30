import { list, oneOf } from './check';
import type { StudioProject } from './types';

export const PROJECT_FEATURE_GROUPS = ['build', 'stream', 'community', 'insights'] as const;
export type ProjectFeatureGroup = typeof PROJECT_FEATURE_GROUPS[number];

/** Missing legacy preferences retain the complete workspace; [] explicitly hides all groups. */
export function projectFeatureGroupsCheck(value: unknown): ProjectFeatureGroup[] {
  const groups = list(oneOf(PROJECT_FEATURE_GROUPS), { max: PROJECT_FEATURE_GROUPS.length })(value);
  return PROJECT_FEATURE_GROUPS.filter(group => groups.includes(group));
}
export const visibleProjectGroups = (project?: Pick<StudioProject, 'featureGroups'>): readonly ProjectFeatureGroup[] =>
  project?.featureGroups ?? PROJECT_FEATURE_GROUPS;
