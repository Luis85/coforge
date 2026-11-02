<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useWorkflow } from '../../composables/coforge/use-workflow';
import ConfiguredWorkflowExecution from './ConfiguredWorkflowExecution.vue';
import WorkflowSummary from './WorkflowSummary.vue';
import PolishingActionButton from './PolishingActionButton.vue';
import CurrentPolishedResult from './CurrentPolishedResult.vue';
import PolishingRunHistory from './PolishingRunHistory.vue';
const props = defineProps<{ idea: Idea }>();
const model = useWorkflow(() => props.idea.id);
</script>
<template>
  <div class="cf-idea-workflow-tab">
    <WorkflowSummary v-if="model.selected"
      :paused="model.paused" :summary-label="model.summaryLabel"
      :automatic-step-label="model.automaticStepLabel" :cadence-label="model.cadenceLabel"
      :provider-title="model.providerTitle" :provider-icon="model.providerIcon" :provider-label="model.providerLabel"
    />
    <ConfiguredWorkflowExecution :model="model" compact />
    <section class="cf-idea-section" aria-label="Improvement passes">
      <div class="cf-idea-section-heading">
        <h3>Improvement passes</h3>
        <PolishingActionButton :idea-id="idea.id" />
      </div>
      <p class="cf-idea-help">Follow-up improvements keep their own feedback, proposed result and review history.</p>
      <CurrentPolishedResult :idea="idea" />
      <PolishingRunHistory :idea-id="idea.id" />
    </section>
  </div>
</template>
