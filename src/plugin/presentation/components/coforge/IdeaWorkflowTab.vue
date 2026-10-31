<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useWorkflow } from '../../composables/coforge/use-workflow';
import ConfiguredWorkflowExecution from './ConfiguredWorkflowExecution.vue';
import WorkflowSummary from './WorkflowSummary.vue';
const props = defineProps<{ idea: Idea }>();
const model = useWorkflow(() => props.idea.id);
</script>
<template>
  <div class="cf-idea-workflow-tab">
    <h3>Workflow runs</h3>
    <p class="cf-settings-help">Captured runs, decisions and results for this request. Workflow settings configure future runs.</p>
    <WorkflowSummary v-if="model.selected"
      :paused="model.paused" :summary-label="model.summaryLabel"
      :automatic-step-label="model.automaticStepLabel" :cadence-label="model.cadenceLabel"
      :provider-title="model.providerTitle" :provider-icon="model.providerIcon" :provider-label="model.providerLabel"
    />
    <ConfiguredWorkflowExecution :model="model" />
  </div>
</template>
