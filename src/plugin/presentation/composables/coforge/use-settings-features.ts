import { computed, reactive } from 'vue';
import { PROJECT_FEATURES } from '../../../features/coforge/domain/project-features';
import { STUDIO_GROUPS } from '../../stores/studio-destinations';
import { useSettingsForm } from './use-settings';

/** Group visibility retains individual choices; both belong to the same explicit settings draft. */
export function useSettingsFeatures() {
  const model = useSettingsForm();
  return reactive({ model, groups: computed(() => STUDIO_GROUPS.map(group => {
    const features = PROJECT_FEATURES.filter(feature => feature.group === group.id);
    return { ...group, features, enabled: model.featureGroups.includes(group.id),
      selected: features.filter(feature => model.features.includes(feature.id)).length };
  })) });
}
