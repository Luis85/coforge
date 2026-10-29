<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
import { WORKFLOW_KIND_LABELS } from "../../stores/workflow-editor-draft";
import WorkflowAiStepFields from "./WorkflowAiStepFields.vue";
import WorkflowManualStepFields from "./WorkflowManualStepFields.vue";
import WorkflowNudgeFields from "./WorkflowNudgeFields.vue";
const model = useWorkflowEditorForm();
</script>
<template>
  <section
    :ref="model.bindStepEditor"
    class="cf-workflow-step-editor"
    aria-label="Selected workflow step"
  >
    <template v-if="model.selected"
      ><div class="cf-workflow-step-heading">
        <h2>{{ model.selected.name || "Unnamed step" }}</h2>
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.showStepList()"
        >
          Step list
        </button>
        <span class="cf-badge">{{
          WORKFLOW_KIND_LABELS[model.selected.kind]
        }}</span>
      </div>
      <label class="cf-field"
        ><span>Step name</span
        ><input v-model="model.selected.name" maxlength="100" required /></label
      ><WorkflowAiStepFields
        v-if="model.selected.kind === 'ai'"
      /><WorkflowNudgeFields v-else-if="model.selected.kind === 'nudge'" /><WorkflowManualStepFields v-else />
      <details class="cf-workflow-reference">
        <summary>Step reference</summary>
        <code>{{ model.selected.id }}</code>
        <p class="cf-settings-help">
          The reference stays stable when you rename or move this step.
        </p>
      </details></template
    >
    <div v-else class="cf-intent-empty">
      <h2>Select or add a step</h2>
      <p>Configure its instructions, result contract and who completes it.</p>
    </div>
  </section>
</template>
