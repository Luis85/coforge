<script setup lang="ts">
import { useDurableWorkerReadiness } from "../../composables/coforge/use-durable-worker-readiness";
const props = withDefaults(defineProps<{ blocked?: boolean }>(), {
  blocked: false,
});
const worker = useDurableWorkerReadiness(() => props.blocked);
</script>
<template>
  <details v-if="worker.repairable" class="cf-workflow-options">
    <summary>Unused worker startup needs attention</summary>
    <p>{{ worker.message }}</p>
    <p class="cf-settings-help">
      This repair is offered only for a verified unused startup generation. It
      does not resume a job, start a provider or replace an admitted worker.
      Existing Builds use their own inspection and recovery controls.
    </p>
    <label class="cf-workflow-check"
      ><input
        v-model="worker.repairConsent"
        type="checkbox"
        aria-label="I reviewed the worker startup error"
        :disabled="worker.repairing || blocked"
      />I reviewed this startup error and want to repair the unused worker
      startup.</label
    >
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="worker.repairDisabled"
      @click="worker.repair()"
    >
      {{
        worker.repairing
          ? "Repairing unused startup…"
          : "Repair unused worker startup"
      }}
    </button>
    <p v-if="worker.error" class="cf-inline-error" role="alert">
      {{ worker.error }}
    </p>
  </details>
</template>
