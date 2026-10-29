<script setup lang="ts">
import { useWorkflow } from "../../composables/coforge/use-workflow";
import CfIcon from "./CfIcon.vue";
import WorkflowHistory from "./WorkflowHistory.vue";
import ConfiguredWorkflowExecution from "./ConfiguredWorkflowExecution.vue";
import HerdrPanel from "./HerdrPanel.vue";
import HerdrWorkflowRecovery from "./HerdrWorkflowRecovery.vue";
import CfSubpageNav from "./CfSubpageNav.vue";
import WorkflowEditorView from "./WorkflowEditorView.vue";
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
          Monitor captured runs, manage Herdr workspaces and configure this
          project’s workflow.
        </p>
      </div>
      <div class="cf-workflow-inline cf-workflow-heading-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          v-if="model.page === 'runs' && model.store.activeProject"
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
            ? "Connect Herdr, choose a workspace and verify the target before sending work. Use Workflow runs to follow validated step results."
            : "Choose a request, follow its next step and review the captured results. Workflow settings changes future runs."
      }}
    </p>
    <div
      v-show="model.page === 'runs'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Request workflow runs"
    >
      <div v-if="model.store.activeProject" class="cf-workflow-summary">
        <span
          class="cf-workflow-live-dot"
          :class="{ 'is-paused': model.paused }"
        /><strong>{{ model.summaryLabel }}</strong
        ><span>{{ model.automaticStepLabel }}</span
        ><span>{{ model.cadenceLabel }}</span
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
      v-show="model.page === 'herdr'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Herdr workspace administration"
    >
      <HerdrPanel open />
    </div>
    <section
      v-if="model.page === 'settings'"
      class="cf-subpage-panel cf-workflow-settings-panel"
      aria-label="Project workflow settings"
    >
      <WorkflowEditorView embedded />
    </section>
  </div>
</template>
