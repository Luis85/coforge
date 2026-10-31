<script setup lang="ts">
import { useWorkflowEditorForm } from '../../composables/coforge/use-workflow-editor';
import { WORKFLOW_PRESETS } from '../../stores/workflow-editor-draft';
const model = useWorkflowEditorForm();
</script>
<template>
  <div class="cf-workflow-step-list-tools">
    <details class="cf-workflow-add-step">
      <summary>Add a step</summary>
      <p class="cf-settings-help">{{ model.buckets.activeBucket?.role === 'accepted' ? 'Select an earlier bucket to add executable work.' : `Add steps to ${model.buckets.activeBucket?.name || 'a selected bucket'}.` }}</p>
      <div class="cf-workflow-add-actions">
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.buckets.canAddStep" @click="model.add('council')">Add Ask Council</button>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.buckets.canAddStep" @click="model.add('nudge')">Add agent nudge</button>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.buckets.canAddStep" @click="model.add('ai')">Add AI step</button>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.buckets.canAddStep" @click="model.add('approval')">Add approval</button>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.buckets.canAddStep" @click="model.add('checklist')">Add checklist</button>
      </div>
    </details>
    <details class="cf-workflow-presets">
      <summary>Standard step presets</summary>
      <p class="cf-settings-help">Adds a configured step to the selected bucket. Required previous results are retained; review any dependency errors before saving.</p>
      <div class="cf-workflow-add-actions">
        <button v-for="preset in WORKFLOW_PRESETS" :key="preset.id" type="button" class="cf-btn cf-btn-ghost" :disabled="!model.buckets.canAddStep" @click="model.addPreset(preset.id)">Add {{ preset.name }} preset</button>
      </div>
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.resetStandard()">Replace draft with standard workflow</button>
      <p class="cf-settings-help">Replaces local edits only. Save workflow applies the change.</p>
    </details>
  </div>
</template>
