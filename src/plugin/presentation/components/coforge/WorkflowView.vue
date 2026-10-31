<script setup lang="ts">
import { useWorkflow } from "../../composables/coforge/use-workflow";
import CfIcon from "./CfIcon.vue";
import WorkflowHistory from "./WorkflowHistory.vue";
import HerdrPanel from "./HerdrPanel.vue";
import HerdrWorkflowRecovery from "./HerdrWorkflowRecovery.vue";
import CfSubpageNav from "./CfSubpageNav.vue";
import WorkflowEditorView from "./WorkflowEditorView.vue";
import WorkflowSummary from './WorkflowSummary.vue';
import { WORKFLOW_PAGES } from "../../stores/studio-pages";
withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const model = useWorkflow();
</script>
<template>
  <div class="cf-workflow-page" :class="{ 'is-embedded': embedded }">
    <header class="cf-page-heading cf-workflow-heading">
      <div>
        <component :is="embedded ? 'h2' : 'h1'">Agent workflow</component>
        <p>
          Configure this project's idea-board workflow, inspect step attempts
          and manage Herdr. Open a request's details for its workflow runs.
        </p>
      </div>
      <div class="cf-workflow-inline cf-workflow-heading-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          v-if="model.store.activeProject"
          :disabled="model.store.busy"
          @click="model.togglePause()"
        >
          <CfIcon :name="model.paused ? 'play' : 'pause'" size="sm" />{{
            model.paused ? "Resume automation" : "Pause automation"
          }}
        </button>
      </div>
    </header>
    <p
      v-if="model.error && model.page === 'runs'"
      role="alert"
      class="cf-inline-error"
    >
      {{ model.error }}
    </p>
    <CfSubpageNav
      label="Agent workflow pages"
      :items="WORKFLOW_PAGES"
      :selected="model.page"
      @select="model.selectPage($event)"
    />
    <p class="cf-workflow-page-intro">
      {{
        model.page === "settings"
          ? "Design the process for future requests. Save the workflow and its Markdown templates independently."
          : model.page === "herdr"
            ? "Connect Herdr, choose a workspace and verify the target before sending work. Open a request's Workflow runs tab to follow validated results."
          : model.page === 'runs' ? "Inspect this project's step handoffs. Open an idea's details for its captured workflow runs."
          : model.page === 'limits' ? 'Set the timing and bounded execution allowances shared by this workflow draft.'
          : 'Author reusable answer templates. Template saves remain independent of the workflow draft.'
      }}
    </p>
    <div
      v-show="model.page === 'runs'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Workflow step attempts"
    >
      <WorkflowSummary v-if="model.store.activeProject"
        :paused="model.paused" :summary-label="model.summaryLabel"
        :automatic-step-label="model.automaticStepLabel" :cadence-label="model.cadenceLabel"
        :provider-title="model.providerTitle" :provider-icon="model.providerIcon" :provider-label="model.providerLabel"
      />
      <WorkflowHistory
        :model="model"
      /><HerdrWorkflowRecovery />
    </div>
    <div
      v-show="model.page === 'herdr'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Herdr workspace administration"
    >
      <HerdrPanel open />
    </div>
    <section
      v-show="['settings', 'limits', 'templates'].includes(model.page)"
      class="cf-subpage-panel cf-workflow-settings-panel"
      aria-label="Project workflow settings"
    >
      <WorkflowEditorView embedded :pane="model.page" />
    </section>
  </div>
</template>
