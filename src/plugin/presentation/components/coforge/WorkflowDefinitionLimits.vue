<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
import WorkflowExecutionOverview from './WorkflowExecutionOverview.vue';
const model = useWorkflowEditorForm();
</script>
<template>
  <section class="cf-workflow-definition-limits" aria-label="Workflow timing and native CLI limits">
    <div class="cf-workflow-field-grid">
      <label class="cf-field"
        ><span>Automatic run interval · seconds</span
        ><input
          v-model.number="model.draft.limits.intervalSeconds"
          data-workflow-field="limits.intervalSeconds"
          type="number"
          min="2"
          max="3600"
          step="1"
          required /></label
      ><label class="cf-field"
        ><span>Step timeout · seconds · foreground tasks</span
        ><input
          v-model.number="model.draft.limits.timeoutSeconds"
          data-workflow-field="limits.timeoutSeconds"
          type="number"
          min="15"
          max="1800"
          step="1"
          required /></label
      ><label class="cf-field"
        ><span>Maximum native CLI turns</span
        ><input
          v-model.number="model.draft.limits.maxTurns"
          data-workflow-field="limits.maxTurns"
          type="number"
          min="1"
          max="50"
          step="1"
          required /></label
      ><label class="cf-field"
        ><span>Native CLI budget cap · USD</span
        ><input
          v-model.number="model.draft.limits.maxBudgetUsd"
          data-workflow-field="limits.maxBudgetUsd"
          type="number"
          min="0.1"
          max="20"
          step="0.01"
          required
      /></label>
    </div>
    <p class="cf-settings-help">
      The interval applies to new background runs. Automatic steps inside a
      captured run continue immediately; manual steps wait for your decision.
    </p>
    <p class="cf-settings-help">
      The timeout bounds foreground AI steps. Background Builds use the separate
      execution policy below. A cancelled or
      timed-out Herdr agent can continue externally and needs recovery
      inspection. Herdr interactive spending and turn limits are configured
      externally; the native CLI caps do not enforce them.
      For Codex, the turn setting caps CoForge tool calls; its CLI does not
      enforce the Claude USD spending cap. The foreground timeout and background
      execution policy remain separate.
    </p>
    <WorkflowExecutionOverview />
  </section>
</template>
