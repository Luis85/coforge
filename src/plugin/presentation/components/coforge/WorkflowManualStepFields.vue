<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
import MarkdownBody from "./MarkdownBody.vue";
const model = useWorkflowEditorForm();
</script>
<template>
  <div v-if="model.selected && model.selected.kind !== 'ai'">
    <label class="cf-field"
      ><span>Manual step instructions</span
      ><textarea
        v-model="model.selected.instructions"
        aria-label="Manual step instructions"
        rows="6"
        maxlength="8000"
      /><small
        >Explain what you need to inspect or decide. Markdown is
        supported.</small
      ></label
    >
    <details
      v-if="model.selected.instructions"
      class="cf-workflow-manual-preview"
    >
      <summary>Preview instructions</summary>
      <MarkdownBody :source="model.selected.instructions" />
    </details>
    <template v-if="model.selected.kind === 'checklist'"
      ><h3>Checklist</h3>
      <div
        v-for="(item, index) in model.selected.items"
        :key="item.id"
        class="cf-workflow-checklist-editor"
      >
        <label class="cf-field"
          ><span>Checklist item {{ index + 1 }}</span
          ><input v-model="item.label" maxlength="500" required /></label
        ><label class="cf-workflow-check"
          ><input v-model="item.required" type="checkbox" /><span
            >Required</span
          ></label
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          :aria-label="`Remove checklist item ${index + 1}`"
          @click="model.removeChecklistItem(item.id)"
        >
          Remove
        </button>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.selected.items.length >= 40"
        @click="model.addChecklistItem()"
      >
        Add checklist item
      </button>
      <p class="cf-settings-help">
        All required items must be checked before you can complete this step.
      </p></template
    >
    <p v-else class="cf-settings-help">
      Only your explicit approval advances this step.
    </p>
    <p class="cf-workflow-policy">
      Completing this manual step does not replace final review of code changes.
    </p>
  </div>
</template>
