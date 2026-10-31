<script setup lang="ts">
import { useDurableWorkerReadiness } from "../../composables/coforge/use-durable-worker-readiness";
import WorkerStartupRepair from "./WorkerStartupRepair.vue";
const worker = useDurableWorkerReadiness();
</script>
<template>
  <section
    class="cf-idea-section"
    aria-label="Background Build worker readiness"
  >
    <h3>Background Build worker</h3>
    <p role="status">
      {{ worker.ready ? "Worker verified" : "Worker not verified" }} ·
      {{ worker.message }}
    </p>
    <p class="cf-settings-help">
      Configured admissions: {{ worker.limits.builds }} background Builds and
      {{ worker.limits.shortTasks }} short tasks. Edit these vault-wide limits
      under Vault integrations; lowering them does not cancel admitted work.
    </p>
    <p class="cf-settings-help">
      Configure the native Node executable under Vault integrations in
      Obsidian's CoForge settings. This check does not start a Build. Provider
      sign-in, model access and project permissions are checked separately when
      a Build is admitted.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="worker.disabled"
      @click="worker.check()"
    >
      {{
        worker.checking
          ? "Checking background worker…"
          : "Check background worker"
      }}
    </button>
    <p v-if="worker.error" class="cf-inline-error" role="alert">
      {{ worker.error }}
    </p>
    <WorkerStartupRepair />
  </section>
</template>
