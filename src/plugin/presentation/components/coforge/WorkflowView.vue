<script setup lang="ts">
import { useWorkflow } from "../../composables/coforge/use-workflow";
import CfIcon from "./CfIcon.vue";
import WorkflowHistory from "./WorkflowHistory.vue";
import ConfiguredWorkflowExecution from "./ConfiguredWorkflowExecution.vue";
import HerdrPanel from "./HerdrPanel.vue";
import HerdrWorkflowRecovery from "./HerdrWorkflowRecovery.vue";
import CfSubpageNav from "./CfSubpageNav.vue";
import { WORKFLOW_PAGES } from "../../stores/studio-pages";
const model = useWorkflow();
</script>
<template>
  <div class="cf-workflow-page">
    <header class="cf-page-heading cf-workflow-heading">
      <div>
        <h1>Agent workflow</h1>
        <p>
          Run this project’s saved steps, complete human decisions and review
          every attempt. Configure the process separately in Workflow settings.
        </p>
      </div>
      <div class="cf-workflow-inline cf-workflow-heading-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.editWorkflow()"
        >
          <CfIcon name="list-settings" size="sm" />Workflow settings</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          v-if="model.store.workflowTool === 'runs'"
          :disabled="model.store.busy"
          @click="model.togglePause()"
        >
          <CfIcon :name="model.paused ? 'play' : 'pause'" size="sm" />{{
            model.paused ? "Resume automation" : "Pause automation"
          }}
        </button>
      </div>
    </header>
    <p v-if="model.error" role="alert" class="cf-inline-error">
      {{ model.error }}
    </p>
    <CfSubpageNav
      label="Agent workflow pages"
      :items="WORKFLOW_PAGES"
      :selected="model.store.workflowTool"
      @select="model.store.workflowTool = $event"
    />
    <div
      v-show="model.store.workflowTool === 'runs'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Request workflow runs"
    >
      <div class="cf-workflow-summary">
        <span
          class="cf-workflow-live-dot"
          :class="{ 'is-paused': model.paused }"
        /><strong>{{ model.summaryLabel }}</strong
        ><span>{{ model.enabledCount }} AI steps automatic</span
        ><span>New automatic runs · {{ model.intervalSeconds }}s interval</span
        ><span class="cf-workflow-mode-tag" :title="model.providerTitle"
          ><CfIcon :name="model.providerIcon" size="sm" />{{
            model.providerLabel
          }}</span
        >
      </div>
      <ConfiguredWorkflowExecution :model="model" /><WorkflowHistory
        :model="model"
      /><HerdrWorkflowRecovery />
    </div>
    <div
      v-show="model.store.workflowTool === 'herdr'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Herdr workspace administration"
    >
      <HerdrPanel open />
    </div>
  </div>
</template>
