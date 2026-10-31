<script setup lang="ts">
import { useWorkflowLibrary } from '../../composables/coforge/use-workflow-library';
const model = useWorkflowLibrary();
</script>
<template>
  <details class="cf-workflow-related">
    <summary>Copy workflow from another project</summary>
    <p class="cf-settings-help">Start from another project's saved workflow. Copying only changes this editor's draft; saving creates an independent workflow for this project and never edits or starts the source workflow.</p>
    <p v-if="!model.sources.length" class="cf-settings-help">No other available project has a saved workflow yet.</p>
    <label v-else class="cf-field"><span>Saved workflow to copy</span>
      <select v-model="model.sourceId" aria-label="Saved workflow to copy">
        <option value="">Choose a saved project workflow</option>
        <option v-for="source in model.sources" :key="source.projectId" :value="source.projectId">{{ source.projectName }} · {{ source.definition.name }}</option>
      </select>
    </label>
    <section v-if="model.preview" aria-label="Workflow copy preview">
      <p><strong>{{ model.preview.definition.name }}</strong> from {{ model.preview.projectName }} · {{ model.preview.definition.steps.length }} steps · {{ model.preview.definition.startupMode === 'play' ? 'Start playing' : 'Start paused' }} when CoForge reopens.</p>
      <ol><li v-for="step in model.preview.definition.steps" :key="step.id">{{ step.name }}</li></ol>
      <ul v-if="model.preview.warnings.length" aria-label="Project bindings to review"><li v-for="warning in model.preview.warnings" :key="warning">{{ warning }}</li></ul>
      <p v-if="model.stale" class="cf-inline-error" role="status">The saved source changed or became unavailable. Review its latest version or choose another workflow.</p>
      <button v-if="model.stale" type="button" class="cf-btn cf-btn-secondary" @click="model.refresh()">Review latest source</button>
      <label v-if="model.dirty" class="cf-check"><input v-model="model.replaceDraft" type="checkbox" aria-label="Replace my unsaved workflow draft" />Replace my unsaved workflow draft</label>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.disabled" @click="model.copy()">Copy into draft</button>
    </section>
    <p v-if="model.copied" class="cf-settings-help" role="status">{{ model.copied }}</p>
  </details>
</template>
