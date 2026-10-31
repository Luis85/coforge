<script setup lang="ts">
import { useWorkflowEditorForm } from '../../composables/coforge/use-workflow-editor';
import WorkflowStepRow from './WorkflowStepRow.vue';
import WorkflowStepTools from './WorkflowStepTools.vue';
import CfIcon from './CfIcon.vue';
const model = useWorkflowEditorForm();
</script>
<template>
  <section :ref="model.bindStepList" class="cf-workflow-step-list" data-workflow-field="steps" tabindex="-1" aria-label="Workflow step order">
    <div class="cf-workflow-step-list-header">
      <h2>Buckets &amp; steps <span>{{ model.draft.steps.length }}/40 steps</span></h2>
      <p class="cf-settings-help">Set bucket order, then edit the steps inside.</p>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="(model.draft.buckets?.length ?? 0) >= 12" @click="model.buckets.addBucket()"><CfIcon name="plus" size="sm" />Add bucket</button>
    </div>
    <ol class="cf-workflow-buckets" aria-label="Workflow buckets" data-workflow-field="buckets" tabindex="-1">
      <li v-for="bucket in model.buckets.rows" :key="bucket.id" :data-bucket-id="bucket.id" class="cf-workflow-bucket" :class="{ 'is-selected-bucket': model.buckets.selectedBucketId === bucket.id }">
        <div class="cf-workflow-bucket-heading">
          <div class="cf-workflow-bucket-identity">
            <button type="button" class="cf-workflow-bucket-select" :aria-label="`Edit ${bucket.name || 'Unnamed'} bucket`" :aria-describedby="`${model.buckets.descriptionPrefix}-${bucket.id}`" :aria-current="model.buckets.selectedBucketId === bucket.id ? 'true' : undefined" @click="model.buckets.selectBucket(bucket.id)">
              <strong>{{ bucket.name || 'Unnamed bucket' }}</strong>
            </button>
            <small :id="`${model.buckets.descriptionPrefix}-${bucket.id}`">{{ bucket.role === 'inbox' ? 'Start' : bucket.role === 'accepted' ? 'Outcome' : `${bucket.steps.length} ${bucket.steps.length === 1 ? 'step' : 'steps'}` }}</small>
          </div>
          <div v-if="bucket.role === 'process'" class="cf-workflow-bucket-actions">
            <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Move ${bucket.name} bucket up`" :disabled="bucket.index <= 1" @click="model.buckets.moveBucket(bucket.id, -1)"><CfIcon name="arrow-up" size="sm" /></button>
            <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Move ${bucket.name} bucket down`" :disabled="bucket.index >= (model.draft.buckets?.length ?? 0) - 2" @click="model.buckets.moveBucket(bucket.id, 1)"><CfIcon name="arrow-down" size="sm" /></button>
          </div>
        </div>
        <ol v-if="bucket.steps.length" :aria-label="`Steps in ${bucket.name}`" class="cf-workflow-bucket-steps">
          <WorkflowStepRow v-for="(step, index) in bucket.steps" :key="step.id" :step="step" :index="index" :count="bucket.steps.length" />
        </ol>
        <p v-else class="cf-settings-help cf-workflow-bucket-empty">{{ bucket.role === 'accepted' ? 'Final streamer acceptance' : 'No steps in this bucket' }}</p>
      </li>
    </ol>
    <WorkflowStepTools />
  </section>
</template>
