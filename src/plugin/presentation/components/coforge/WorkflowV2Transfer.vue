<script setup lang="ts">
import { useWorkflowV2EditorForm } from "../../composables/coforge/use-workflow-v2-editor";
const model = useWorkflowV2EditorForm();
</script>
<template>
  <details>
    <summary>Import and export proposal workflows</summary>
    <p class="cf-settings-help">
      Import validates an explicit coforge-workflow/v2 definition and previews
      draft replacement. Saving remains a separate action. References must
      resolve to local agents and councils before execution.
    </p>
    <p class="cf-settings-help">
      Answer template references belong to this project. Their Markdown files
      are managed separately and are not included in workflow JSON. Recreate or
      reassign templates when importing into another project.
    </p>
    <label class="cf-field"
      ><span>Proposal workflow JSON</span
      ><textarea
        v-model="model.store.importJson"
        rows="6"
        spellcheck="false"
      /></label
    ><button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.store.busy || !model.store.importJson"
      @click="model.previewImport()"
    >
      Preview proposal import
    </button>
    <section
      v-if="model.store.importPreview"
      aria-label="Proposal import replacement preview"
    >
      <h3>{{ model.store.importPreview.name }}</h3>
      <p>
        {{ model.store.importPreview.steps.length }} steps ·
        {{ model.store.importPreview.subjectMode }} subject · team
        {{ model.store.importPreview.teamId }}
      </p>
      <pre>{{ JSON.stringify(model.store.importPreview, null, 2) }}</pre>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.replaceDraft()"
      >
        Replace proposal draft
      </button>
    </section>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="!model.store.draft"
      @click="model.exportDefinition()"
    >
      Preview proposal export</button
    ><label v-if="model.store.exportJson" class="cf-field"
      ><span>Portable proposal workflow</span
      ><textarea
        :value="model.store.exportJson"
        rows="8"
        readonly
        spellcheck="false"
      />
    </label>
  </details>
</template>
