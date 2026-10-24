<script setup lang="ts">
import { useWorkflow } from '../../composables/coforge/use-workflow';
import CfIcon from './CfIcon.vue';
import WorkflowHistory from './WorkflowHistory.vue';
import WorkflowStages from './WorkflowStages.vue';
import WorkflowWorkbench from './WorkflowWorkbench.vue';

const model = useWorkflow();
</script>
<template>
  <div class="cf-workflow-page">
    <header class="cf-page-heading cf-workflow-heading">
      <div>
        <h1>Agent workflow</h1>
        <p>Your community’s ideas. A repeatable path to a playable increment.</p>
      </div>
      <div class="cf-workflow-inline cf-workflow-heading-actions">
        <button
          type="button" class="cf-btn cf-btn-secondary" :disabled="!model.canRunNext"
          title="Dispatch the next eligible idea from an enabled stage" @click="model.runNext()"
        >
          <CfIcon name="play" size="sm" /> Run next
        </button>
        <button
          type="button" class="cf-btn" :class="model.paused ? 'cf-btn-primary' : 'cf-btn-secondary'" :disabled="model.store.busy"
          @click="model.togglePause()"
        >
          <CfIcon :name="model.paused ? 'play' : 'pause'" size="sm" />
          {{ model.paused ? 'Resume automation' : 'Pause automation' }}
        </button>
      </div>
    </header>
    <div v-if="model.error" class="cf-workflow-alert" role="alert">
      <CfIcon name="circle-alert" />
      <span>{{ model.error }}</span>
    </div>
    <div class="cf-workflow-summary">
      <span class="cf-workflow-live-dot" :class="{ 'is-paused': model.paused }" />
      <strong>{{ model.summaryLabel }}</strong>
      <span>{{ model.enabledCount }} of 4 stages automated</span>
      <span class="cf-workflow-dot-separator">·</span>
      <span>Checks every {{ model.intervalSeconds }}s</span>
      <span class="cf-workflow-mode-tag" :title="model.providerTitle">
        <CfIcon :name="model.providerIcon" size="sm" />
        {{ model.providerLabel }}
      </span>
    </div>
    <div class="cf-workflow-layout">
      <WorkflowStages :model="model" />
      <WorkflowWorkbench :model="model" />
    </div>
    <WorkflowHistory :model="model" />
  </div>
</template>
