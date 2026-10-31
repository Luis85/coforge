import { computed, onMounted, reactive, ref } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { useCoforge } from '../../context/coforge-context';
import { useCouncilEntry } from './use-council-entry';
import type { CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import type { WorkflowOutput } from '../../../features/coforge/domain/configured-workflow';
import { useCouncilSelection } from './council-selection';

export function useWorkflowCouncil() {
  const openCouncil = useCouncilEntry();
  const editor = useWorkflowEditorForm();
  const { host } = useCoforge();
  const catalogue = ref<CouncilCatalogueSnapshot>({ valid: [], invalid: [] });
  const error = ref('');
  const loading = ref(false);
  const step = computed(() => editor.selected?.kind === 'council' ? editor.selected : undefined);
  const selection = useCouncilSelection(() => catalogue.value, () => editor.project?.id ?? '', () => step.value?.councilId ?? '');
  async function refresh() {
    loading.value = true; error.value = '';
    try { catalogue.value = await host.council?.catalogue.list() ?? { valid: [], invalid: [] }; }
    catch { error.value = 'Could not load Councils. Open The Council → Setup → Councils & roster to repair them.'; }
    finally { loading.value = false; }
  }
  onMounted(refresh);
  const inputs = computed(() => [...new Set(editor.draft.steps.slice(0, editor.draft.steps.findIndex(item => item.id === step.value?.id)).flatMap(item => item.kind === 'ai' ? [item.output] : item.kind === 'council' ? ['markdown' as const] : []))]);
  const readiness = computed(() => {
    if (loading.value) return 'Loading the saved Council configuration.';
    if (!host.council) return 'Live Council workflows are available in desktop Obsidian.';
    if (selection.issue) return selection.issue;
    if (!selection.selected) return 'Choose a Council to review its live execution readiness.';
    if (selection.members.some(member => member.provider === 'demo')) return 'This Council uses Simulation. Request workflows require live Claude or Codex CoWorkers. Try a simulation from The Council or select live CoWorkers before starting this workflow.';
    if (selection.members.some(member => member.provider === 'herdr')) return 'Herdr does not support isolated Council workflow invocations. Select live Claude or Codex CoWorkers.';
    if (selection.members.some(member => member.provider === 'claude' && !editor.store.state?.runtime.cliAvailable || member.provider === 'codex' && !editor.store.state?.runtime.codexAvailable)) return 'Council configuration is ready, but a selected native runtime is unavailable. Check Project settings → Runtime before running.';
    return 'Council configuration and the selected native runtimes are ready. The designated Council desktop still controls execution and pause state.';
  });
  return reactive({ step, selection, inputs, error, loading, readiness, refresh,
    contextMode: computed(() => step.value?.contextMode ?? (step.value?.inputs?.length ? 'selected' : 'all')),
    changeContextMode: (event: Event) => { if (!(event.target instanceof HTMLSelectElement) || !step.value) return; const mode = event.target.value; if (mode === 'all' || mode === 'selected' || mode === 'none') { step.value.contextMode = mode; if (mode !== 'selected') step.value.inputs = []; } },
    openSetup: () => openCouncil({ page: 'definitions' }),
    openRuntime: () => editor.store.openSettingsTool('runtime'),
    toggleRole: (role: WorkflowOutput) => { const current = step.value; if (current) current.inputs = current.inputs?.includes(role) ? current.inputs.filter(item => item !== role) : [...(current.inputs ?? []), role]; },
  });
}
