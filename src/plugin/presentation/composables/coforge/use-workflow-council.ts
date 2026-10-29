import { computed, onMounted, reactive, ref } from 'vue';
import { useWorkflowEditorForm } from './use-workflow-editor';
import { useCoforge } from '../../context/coforge-context';
import type { CouncilCatalogueSnapshot } from '../../../features/coforge/application/council-catalogue';
import type { WorkflowOutput } from '../../../features/coforge/domain/configured-workflow';
import { useCouncilSelection } from './council-selection';

export function useWorkflowCouncil() {
  const editor = useWorkflowEditorForm();
  const { host } = useCoforge();
  const catalogue = ref<CouncilCatalogueSnapshot>({ valid: [], invalid: [] });
  const error = ref('');
  const step = computed(() => editor.selected?.kind === 'council' ? editor.selected : undefined);
  const selection = useCouncilSelection(() => catalogue.value, () => editor.project?.id ?? '', () => step.value?.councilId ?? '');
  onMounted(async () => {
    try { catalogue.value = await host.council?.catalogue.list() ?? { valid: [], invalid: [] }; }
    catch { error.value = 'Could not load Councils. Open The Council → Definitions to repair them.'; }
  });
  const inputs = computed(() => [...new Set(editor.draft.steps.slice(0, editor.draft.steps.findIndex(item => item.id === step.value?.id)).flatMap(item => item.kind === 'ai' ? [item.output] : item.kind === 'council' ? ['markdown' as const] : []))]);
  return reactive({ step, selection, inputs, error,
    toggleRole: (role: WorkflowOutput) => { const current = step.value; if (current) current.inputs = current.inputs?.includes(role) ? current.inputs.filter(item => item !== role) : [...(current.inputs ?? []), role]; },
  });
}
