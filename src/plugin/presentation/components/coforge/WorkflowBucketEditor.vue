<script setup lang="ts">
import { useWorkflowEditorForm } from '../../composables/coforge/use-workflow-editor';
const model = useWorkflowEditorForm();
</script>
<template>
  <div v-if="model.buckets.selectedBucket" class="cf-workflow-bucket-editor">
    <div class="cf-workflow-step-heading"><h2>{{ model.buckets.selectedBucket.name || 'Unnamed bucket' }}</h2><button type="button" class="cf-btn cf-btn-ghost" @click="model.showStepList(model.buckets.selectedBucket.id)">Bucket list</button></div>
    <label class="cf-field"><span>Bucket name</span><input v-model="model.buckets.selectedBucket.name" aria-label="Bucket name" data-workflow-field="bucket.name" :data-editing-bucket-id="model.buckets.selectedBucket.id" maxlength="100" required /></label>
    <label class="cf-field"><span>Bucket description</span><textarea v-model="model.buckets.selectedBucket.description" aria-label="Bucket description" data-workflow-field="bucket.description" rows="3" maxlength="1000" /><small>Describe the work or outcome represented by this board bucket.</small></label>
    <p v-if="model.buckets.selectedBucket.role === 'accepted'" class="cf-settings-help">Accepted is an outcome after final streamer review. It cannot contain executable steps or be moved or removed.</p>
    <p v-else-if="model.buckets.selectedBucket.role === 'inbox'" class="cf-settings-help">Inbox starts the process. Its label and steps are editable; the first bucket cannot be moved or removed.</p>
    <template v-else>
      <p class="cf-settings-help">An empty bucket remains on the board and executes no work.</p>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.draft.steps.some(step => step.bucketId === model.buckets.selectedBucket?.id)" @click="model.buckets.removeBucket(model.buckets.selectedBucket.id)">Remove {{ model.buckets.selectedBucket.name }} bucket</button>
      <p v-if="model.draft.steps.some(step => step.bucketId === model.buckets.selectedBucket?.id)" class="cf-settings-help">Move or remove its steps before removing this bucket.</p>
    </template>
    <details class="cf-workflow-reference"><summary>Bucket reference</summary><code>{{ model.buckets.selectedBucket.id }}</code><p class="cf-settings-help">The reference stays stable when you rename or move this bucket.</p></details>
  </div>
</template>
