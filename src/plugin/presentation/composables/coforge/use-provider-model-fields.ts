import { computed, reactive, watch } from 'vue';
import { modelEfforts, providerModels, type ReasoningEffort } from '../../../features/coforge/domain/provider-models';
import type { Provider } from '../../../features/coforge/domain/types';

export interface ProviderModelChoice { provider: Provider; model: string; effort?: ReasoningEffort }
export function useProviderModelFields(props: { choice: ProviderModelChoice; fieldPrefix?: string }) {
  const models = computed(() => providerModels(props.choice.provider));
  const custom = computed(() => !models.value.some(item => item.value === props.choice.model));
  const efforts = computed(() => modelEfforts(props.choice.provider, props.choice.model));
  function reconcileEffort() {
    if (props.choice.effort && !efforts.value.includes(props.choice.effort)) delete props.choice.effort;
  }
  watch(() => props.choice.provider, provider => {
    const known = [...providerModels('claude'), ...providerModels('codex')].some(item => item.value === props.choice.model);
    if (provider !== 'demo' && known && custom.value) props.choice.model = models.value[0]?.value ?? props.choice.model;
    reconcileEffort();
  });
  return reactive({
    models, custom, efforts,
    field: (name: string) => props.fieldPrefix ? `${props.fieldPrefix}.${name}` : name,
    model: computed({ get: () => props.choice.provider === 'demo' ? props.choice.model : custom.value ? '__custom' : props.choice.model, set: value => {
      if (value !== '__custom') props.choice.model = value;
      else props.choice.model = '';
      reconcileEffort();
    } }),
    customModel: computed({ get: () => props.choice.model, set: value => { props.choice.model = value; reconcileEffort(); } }),
    effort: computed({ get: () => props.choice.effort ?? '', set: (value: ReasoningEffort | '') => {
      if (value && efforts.value.includes(value)) props.choice.effort = value;
      else delete props.choice.effort;
    } }),
    changeProvider: reconcileEffort,
  });
}
