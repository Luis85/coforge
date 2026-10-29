<script setup lang="ts">
import {
  selectedOutputTemplate,
  useWorkflowOutputTemplates,
} from "../../composables/coforge/use-workflow-output-templates";
import { useWorkflowTemplateSelection } from "../../composables/coforge/use-workflow-template-selection";
const props = defineProps<{ projectId: string; modelValue?: string }>();
defineEmits<{ "update:modelValue": [value: string | undefined] }>();
const model = useWorkflowOutputTemplates(() => props.projectId);
const selectedTemplate = useWorkflowTemplateSelection(
  () => props.projectId,
  () => props.modelValue,
);
</script>
<template>
  <div class="cf-workflow-template-picker">
    <label class="cf-field"
      ><span>Answer / output template</span>
      <select
        :value="modelValue ?? ''"
        aria-label="Answer / output template"
        :disabled="model.busy"
        @change="$emit('update:modelValue', selectedOutputTemplate($event))"
      >
        <option value="">No template</option>
        <option
          v-if="
            modelValue &&
            !model.editor.templates.some((item) => item.id === modelValue)
          "
          :value="modelValue"
        >
          Unavailable template · {{ modelValue }}
        </option>
        <option
          v-for="template in model.editor.templates"
          :key="template.id"
          :value="template.id"
        >
          {{ template.name }}
        </option>
      </select>
      <small
        >Optional Markdown structure for this answer. Manage this project's
        templates below. The result contract still applies.</small
      >
    </label>
    <details v-if="selectedTemplate" class="cf-workflow-selected-template">
      <summary>Preview selected template</summary>
      <p class="cf-settings-help">
        Current saved Markdown for {{ selectedTemplate.name }}. New runs capture
        this content; existing runs retain their original version.
      </p>
      <pre
        class="cf-workflow-json"
        tabindex="0"
        aria-label="Selected template Markdown source"
        >{{ selectedTemplate.markdown }}</pre>
    </details>
    <button type="button" class="cf-btn cf-btn-ghost" @click="model.manage()">
      Manage templates
    </button>
    <p
      v-if="
        modelValue &&
        model.editor.loaded &&
        !model.editor.templates.some((item) => item.id === modelValue)
      "
      class="cf-inline-error"
      role="alert"
    >
      This template is missing or invalid. Clear or replace it before starting a
      new run.
    </p>
    <p v-if="model.editor.error" class="cf-inline-error" role="alert">
      {{ model.editor.error }}
    </p>
    <p v-if="!model.available" class="cf-settings-help">
      Template files can be managed when this workflow is open in Obsidian.
    </p>
  </div>
</template>
