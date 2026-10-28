<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
const model = useWorkflowEditorForm();
</script>
<template>
  <details class="cf-workflow-definition-limits">
    <summary>Workflow timing and native CLI limits</summary>
    <div class="cf-workflow-field-grid">
      <label class="cf-field"
        ><span>Automatic run interval · seconds</span
        ><input
          v-model.number="model.draft.limits.intervalSeconds"
          type="number"
          min="2"
          max="3600"
          step="1"
          required /></label
      ><label class="cf-field"
        ><span>Step timeout · seconds</span
        ><input
          v-model.number="model.draft.limits.timeoutSeconds"
          type="number"
          min="15"
          max="1800"
          step="1"
          required /></label
      ><label class="cf-field"
        ><span>Maximum native CLI turns</span
        ><input
          v-model.number="model.draft.limits.maxTurns"
          type="number"
          min="1"
          max="50"
          step="1"
          required /></label
      ><label class="cf-field"
        ><span>Native CLI budget cap · USD</span
        ><input
          v-model.number="model.draft.limits.maxBudgetUsd"
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
      The timeout bounds CoForge’s wait for each AI step. A cancelled or
      timed-out Herdr agent can continue externally and needs recovery
      inspection. Herdr interactive spending and turn limits are configured
      externally; the native CLI caps do not enforce them.
    </p>
  </details>
</template>
