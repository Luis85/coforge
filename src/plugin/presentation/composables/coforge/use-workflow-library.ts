import { computed, reactive, ref, toRaw, watch } from 'vue';
import { workflowDefinitionCheck, type WorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { prepareWorkflowCopy, type WorkflowCopyPreview } from '../../../features/coforge/application/workflow-copy';
import { useWorkflowEditorForm } from './use-workflow-editor';

interface SavedWorkflow { projectId: string; projectName: string; definition: WorkflowDefinition }
interface Preview extends WorkflowCopyPreview { projectId: string; projectName: string; identity: string }

/** Selecting a saved source only prepares a preview. Copy and Save are separate explicit actions. */
export function useWorkflowLibrary() {
  const editor = useWorkflowEditorForm();
  const sourceId = ref('');
  const preview = ref<Preview | null>(null);
  const replaceDraft = ref(false);
  const copied = ref('');
  const sources = computed<SavedWorkflow[]>(() => (editor.store.state?.projects ?? []).flatMap(project => {
    if (project.id === editor.project?.id || project.unavailable || !project.settings.workflow) return [];
    try { return [{ projectId: project.id, projectName: project.settings.projectName, definition: workflowDefinitionCheck(project.settings.workflow) }]; }
    catch { return []; }
  }));
  const selected = computed(() => sources.value.find(source => source.projectId === sourceId.value));
  const stale = computed(() => preview.value !== null && (!selected.value || JSON.stringify(selected.value.definition) !== preview.value.identity));
  function inspect() {
    replaceDraft.value = false;
    copied.value = '';
    const source = selected.value;
    preview.value = source ? { ...prepareWorkflowCopy(source.definition, crypto.randomUUID()), projectId: source.projectId,
      projectName: source.projectName, identity: JSON.stringify(source.definition) } : null;
  }
  watch(sourceId, inspect);
  watch(() => editor.project?.id, () => { sourceId.value = ''; preview.value = null; replaceDraft.value = false; copied.value = ''; });
  const disabled = computed(() => !preview.value || stale.value || editor.saving || Boolean(editor.blocked) || editor.dirty && !replaceDraft.value);
  return reactive({
    sources, sourceId, preview, replaceDraft, copied, stale, disabled, refresh: inspect,
    copy: () => {
      if (disabled.value || !preview.value) return;
      editor.draft = structuredClone(toRaw(preview.value.definition));
      editor.selectedId = editor.draft.steps[0]?.id ?? '';
      copied.value = `Copied from ${preview.value.projectName} into this draft. Review the steps and startup choice, then Save workflow. The original is unchanged.`;
      replaceDraft.value = false;
    },
    dirty: computed(() => editor.dirty),
  });
}
