import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import type { AiWorkflowStep } from '../../../features/coforge/domain/configured-workflow';
import type { AgentDefinition } from '../../../features/coforge/domain/council-definitions';

type AssignableAgent = Pick<AiWorkflowStep, 'provider' | 'model' | 'effort' | 'coworkerId' | 'herdrAgent'>;
function applyAgent(current: AssignableAgent, agent: AgentDefinition, herdrProfile: boolean) {
  current.provider = agent.provider; current.model = agent.model;
  if (agent.effort === undefined) delete current.effort; else current.effort = agent.effort;
  if (herdrProfile && agent.provider === 'herdr') current.herdrAgent = 'claude'; else delete current.herdrAgent;
}

export function useWorkflowCoworkerFields<T extends AssignableAgent>(step: () => T | undefined, herdrProfile = true) {
  const { host } = useCoforge();
  const agents = ref<AgentDefinition[]>([]);
  const loading = ref(false);
  const error = ref('');
  let closed = false;
  async function refresh() {
    if (loading.value) return;
    loading.value = true; error.value = '';
    try {
      if (!host.council) { error.value = 'Saved CoWorkers are available in desktop Obsidian. Use manual configuration here.'; return; }
      const catalogue = await host.council.catalogue.list();
      if (!closed) agents.value = catalogue.valid.flatMap(entry => entry.definition.schema === 'agent/v1' ? [entry.definition] : []);
    } catch { if (!closed) error.value = 'Saved CoWorkers could not be loaded. Refresh the catalogue or repair definitions on CoWorkers.'; }
    finally { if (!closed) loading.value = false; }
  }
  const choices = computed(() => agents.value.filter(agent => agent.enabled));
  const selected = computed(() => choices.value.find(agent => agent.id === step()?.coworkerId));
  const mode = computed({ get: () => step()?.coworkerId === undefined ? 'manual' : 'coworker', set: value => {
    const current = step(); if (!current) return;
    if (value === 'coworker') current.coworkerId = '';
    else { if (selected.value) applyAgent(current, selected.value, herdrProfile); delete current.coworkerId; }
  } });
  const selection = computed({ get: () => step()?.coworkerId ?? '', set: value => {
    const current = step(); if (!current) return;
    current.coworkerId = value;
    const agent = choices.value.find(item => item.id === value);
    if (!agent) return;
    applyAgent(current, agent, herdrProfile);
  } });
  const unavailable = computed(() => Boolean(step()?.coworkerId && !selected.value && !loading.value));
  onMounted(refresh); onBeforeUnmount(() => { closed = true; });
  return reactive({ choices, selected, mode, selection, loading, error, refresh, unavailable,
    supported: Boolean(host.council),
    effective: computed(() => {
      const current = step(); const agent = selected.value;
      if (!current || !agent) return current;
      return { ...current, provider: agent.provider, model: agent.model, effort: agent.effort };
    }),
  });
}
