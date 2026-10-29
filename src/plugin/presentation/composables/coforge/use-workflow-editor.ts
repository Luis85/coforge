import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  reactive,
  watch,
  type InjectionKey,
} from "vue";
import { storeToRefs } from "pinia";
import { useWorkflowEditorStore } from "../../stores/coforge-workflow-editor";
import { useCoforge } from "../../context/coforge-context";
import { useStudioStore } from "../../stores/coforge-studio";
import { defaultSettings } from "../../../features/coforge/domain/seed";
import {
  workflowDefinition,
  workflowDefinitionCheck,
  type WorkflowStep,
} from "../../../features/coforge/domain/configured-workflow";
import {
  createWorkflowStep,
  duplicateWorkflowStep,
  moveWorkflowStep,
  presetWorkflowStep,
} from "../../stores/workflow-editor-draft";
import type { AgentStage } from "../../../features/coforge/domain/types";
import { useWorkflowTransfer } from "./use-workflow-transfer";
import { useWorkflowEditorVisibility } from "./use-workflow-editor-visibility";
import {
  workflowEditorIssues,
  type WorkflowEditorIssue,
} from "./workflow-editor-validation";
function createWorkflowEditor() {
  const { studio, host } = useCoforge();
  const store = useStudioStore();
  const project = computed(() => store.activeProject);
  const source = computed(() =>
    workflowDefinition(project.value?.settings ?? defaultSettings()),
  );
  const identity = computed(() => JSON.stringify(source.value));
  const editor = useWorkflowEditorStore();
  const {
    draft,
    selectedId,
    expectedIdentity,
    expectedProject,
    saving,
    error,
    notice,
    stale,
  } = storeToRefs(editor);
  draft.value = structuredClone(source.value);
  expectedIdentity.value = identity.value;
  expectedProject.value = project.value?.id ?? "";
  selectedId.value = draft.value.steps.some(
    (step) => step.id === store.workflowStepSelection,
  )
    ? store.workflowStepSelection
    : (draft.value.steps[0]?.id ?? "");
  saving.value = false;
  stale.value = false;
  error.value = "";
  notice.value = "";
  editor.session = crypto.randomUUID();
  editor.transferMode = null;
  editor.importPreview = null;
  editor.importText = "";
  editor.exportJson = "";
  editor.exportPath = "";
  editor.exporting = false;
  const visibility = useWorkflowEditorVisibility(selectedId);
  const dirty = computed(
    () => JSON.stringify(draft.value) !== expectedIdentity.value,
  );
  const selected = computed(() =>
    draft.value.steps.find((step) => step.id === selectedId.value),
  );
  const validation = computed(() => {
    try {
      workflowDefinitionCheck(draft.value);
      return "";
    } catch (cause) {
      return cause instanceof Error
        ? cause.message
        : "Review the workflow fields.";
    }
  });
  function loadSource() {
    draft.value = structuredClone(source.value);
    expectedIdentity.value = identity.value;
    expectedProject.value = project.value?.id ?? "";
    stale.value = false;
    error.value = "";
    notice.value = "";
    if (!draft.value.steps.some((step) => step.id === selectedId.value))
      selectedId.value = draft.value.steps[0]?.id ?? "";
  }
  watch([identity, () => project.value?.id], () => {
    if (saving.value) return;
    if (!dirty.value) loadSource();
    else {
      stale.value = true;
      error.value =
        "This project’s workflow changed outside this editor. Your draft is kept. Export it or discard changes to load the latest source before saving.";
    }
  });
  watch(
    dirty,
    (value) => {
      store.dirtyWorkflow = value;
      if (value) notice.value = "";
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    store.dirtyWorkflow = false;
    editor.session = "";
  });
  const transfer = useWorkflowTransfer({
    draft,
    selectedId,
    error,
    notice,
    saveExport: (json) => host.saveExport(json),
  });
  const blocked = computed(() => {
    if (!project.value || project.value.unavailable)
      return "Choose an available project before saving a workflow.";
    if (
      stale.value ||
      expectedProject.value !== project.value.id ||
      identity.value !== expectedIdentity.value
    )
      return "Discard changes to review the current project workflow before saving.";
    return "";
  });
  async function save() {
    if (saving.value) return;
    error.value = "";
    if (blocked.value || validation.value) {
      error.value = blocked.value || validation.value;
      return;
    }
    saving.value = true;
    try {
      const written = await studio.saveWorkflow(
        expectedProject.value,
        workflowDefinitionCheck(draft.value),
        expectedIdentity.value,
      );
      if (
        written.id !== project.value?.id ||
        JSON.stringify(workflowDefinition(written.settings)) !== identity.value
      ) {
        stale.value = true;
        error.value =
          "Your workflow was saved, but the source changed again. Your draft is kept; discard changes to review the latest definition.";
        return;
      }
      loadSource();
      notice.value =
        "Workflow saved. New runs use this definition; existing runs retain their captured steps.";
    } catch (cause) {
      error.value =
        cause instanceof Error
          ? cause.message
          : "The workflow could not be saved. Your draft is kept.";
    } finally {
      saving.value = false;
    }
  }
  function add(step: WorkflowStep) {
    if (draft.value.steps.length >= 40) return;
    draft.value.steps.push(step);
    selectedId.value = step.id;
    visibility.reveal();
  }
  return reactive({
    ...visibility,
    store,
    project,
    draft,
    selectedId,
    selected,
    dirty,
    aiStepCount: computed(
      () => draft.value.steps.filter((step) => step.kind === "ai").length,
    ),
    humanStepCount: computed(
      () =>
        draft.value.steps.filter(
          (step) => step.kind === "approval" || step.kind === "checklist",
        ).length,
    ),
    saving,
    error,
    notice,
    stale,
    validation,
    nudgeStepCount: computed(
      () => draft.value.steps.filter((step) => step.kind === "nudge").length,
    ),
    issues: computed(() => workflowEditorIssues(draft.value)),
    fixIssue: (issue: WorkflowEditorIssue) => {
      if (issue.stepId) {
        selectedId.value = issue.stepId;
        store.workflowStepSelection = issue.stepId;
      }
      visibility.revealIssue(issue.target, !issue.stepId);
    },
    blocked,
    transfer,
    hasSavedDefinition: computed(() =>
      Boolean(project.value?.settings.workflow),
    ),
    canSave: computed(
      () =>
        (dirty.value || !project.value?.settings.workflow) &&
        !saving.value &&
        !blocked.value &&
        !validation.value,
    ),
    select: (id: string) => {
      selectedId.value = id;
      store.workflowStepSelection = id;
      visibility.reveal();
    },
    add: (kind: WorkflowStep["kind"]) =>
      add(
        createWorkflowStep(kind, project.value?.settings ?? defaultSettings()),
      ),
    addPreset: (stage: AgentStage) =>
      add(
        presetWorkflowStep(stage, project.value?.settings ?? defaultSettings()),
      ),
    duplicate: (id: string) => {
      const copy = duplicateWorkflowStep(draft.value, id);
      if (copy) {
        selectedId.value = copy.id;
        visibility.reveal();
      }
    },
    move: (id: string, direction: -1 | 1) =>
      visibility.retainMoveFocus(id, () =>
        moveWorkflowStep(draft.value, id, direction),
      ),
    remove: (id: string) => {
      const index = draft.value.steps.findIndex((step) => step.id === id);
      if (index < 0) return;
      draft.value.steps.splice(index, 1);
      if (id === selectedId.value)
        selectedId.value =
          draft.value.steps[Math.min(index, draft.value.steps.length - 1)]
            ?.id ?? "";
    },
    addChecklistItem: () => {
      const step = selected.value;
      if (step?.kind === "checklist" && step.items.length < 40)
        step.items.push({ id: crypto.randomUUID(), label: "", required: true });
    },
    removeChecklistItem: (id: string) => {
      const step = selected.value;
      if (step?.kind === "checklist")
        step.items = step.items.filter((item) => item.id !== id);
    },
    resetStandard: () => {
      draft.value = structuredClone(
        workflowDefinition({
          ...(project.value?.settings ?? defaultSettings()),
          workflow: undefined,
        }),
      );
      selectedId.value = draft.value.steps[0]?.id ?? "";
    },
    save: () => {
      void save();
    },
    discard: loadSource,
  });
}
export type WorkflowEditorModel = ReturnType<typeof createWorkflowEditor>;
const KEY: InjectionKey<WorkflowEditorModel> = Symbol("workflow-editor");
export function useWorkflowEditor() {
  const model = createWorkflowEditor();
  provide(KEY, model);
  return model;
}
export function useWorkflowEditorForm() {
  const model = inject(KEY);
  if (!model) throw new Error("The workflow editor is missing.");
  return model;
}
