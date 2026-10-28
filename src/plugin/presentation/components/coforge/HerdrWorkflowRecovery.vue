<script setup lang="ts">
import { useHerdrWorkflowRecovery } from "../../composables/coforge/use-herdr-workflow-recovery";
const model = useHerdrWorkflowRecovery();
</script>
<template>
  <section
    v-if="model.records.length || model.error || model.state.error"
    class="cf-herdr-recovery"
    aria-label="Herdr workflow recovery"
  >
    <h2>Herdr attempts need attention</h2>
    <p>
      A timeout or cancellation ends CoForge’s wait. The external agent may
      still be running. Inspect the original target and its changes before
      acknowledging this hold.
    </p>
    <p
      v-if="model.error || model.state.error"
      role="alert"
      class="cf-inline-error"
    >
      {{ model.error || model.state.error }}
    </p>
    <article v-for="record in model.records" :key="record.id">
      <h3>{{ record.ideaId }} · {{ record.stage }}</h3>
      <p>{{ record.projectId }} · Herdr · Claude Code · {{ record.model }}</p>
      <p>
        Original target: <strong>{{ record.agent }}</strong> ·
        {{ record.workspace }}
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="Boolean(model.working) || model.state.busy"
        @click="model.inspect(record.id)"
      >
        Inspect original Herdr session for {{ record.ideaId }}
      </button>
      <p v-if="record.inspectionSummary" role="status">
        {{ record.inspectionSummary }}
      </p>
      <label
        ><input
          v-model="model.checked[record.id]"
          type="checkbox"
          :disabled="!model.inspected[record.id] || Boolean(model.working)"
        /><span
          >I reviewed {{ record.ideaId }} in the original session and inspected
          its changes.</span
        ></label
      >
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.inspected[record.id] ||
          !model.checked[record.id] ||
          Boolean(model.working) ||
          model.state.busy
        "
        @click="model.acknowledge(record.id)"
      >
        Acknowledge hold for {{ record.ideaId }}
      </button>
      <p class="cf-workflow-help">
        Acknowledgment clears the recovery hold. It does not mark work
        completed, stop the external agent or replay this attempt. Review the
        failed request before an explicit retry.
      </p>
    </article>
  </section>
</template>
