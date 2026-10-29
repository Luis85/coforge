import { defineStore } from "pinia";
import { ref } from "vue";
import type { AICostState } from "../../features/coforge/application/ai-cost-ports";
import type { AICostTask } from "../../features/coforge/domain/ai-costs";
export const useAICostStore = defineStore("coforge-ai-costs", () => {
  const state = ref<AICostState>({ tasks: [], loading: true, error: "" });
  const project = ref("");
  const feature = ref("");
  const search = ref("");
  const source = ref("");
  const agent = ref('');
  const team = ref('');
  const council = ref('');
  const dimension = ref<import('../../features/coforge/domain/ai-cost-groups').CostDimension>('agent');
  const editing = ref<AICostTask | null>(null);
  const expected = ref("");
  const amount = ref("");
  const note = ref("");
  const busy = ref(false);
  const error = ref("");
  const notice = ref("");
  const example = ref(false);
  const page = ref(0);
  return {
    state,
    project,
    feature,
    search,
    source,
    agent, team, council, dimension,
    editing,
    expected,
    amount,
    note,
    busy,
    error,
    notice,
    example,
    page,
  };
});
