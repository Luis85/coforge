<script setup lang="ts">
import { usePluginSettingsForm } from "../../composables/coforge/use-plugin-settings";
import { useDurableWorkerReadiness } from "../../composables/coforge/use-durable-worker-readiness";
import PluginSettingsRow from "./PluginSettingsRow.vue";
import { useWorkerIntegrationFields } from "../../composables/coforge/use-worker-integration-fields";
import WorkerStartupRepair from "./WorkerStartupRepair.vue";
const model = usePluginSettingsForm();
const worker = useDurableWorkerReadiness(() => model.workerNodeChanged);
const lanes = useWorkerIntegrationFields();
</script>
<template>
  <h3 class="cf-setting-heading">Background Build worker</h3>
  <p class="cf-plugin-settings-section-intro">
    A verified native Node runtime runs the bundled worker for admitted Claude
    Code and Codex Builds. It owns execution after Obsidian closes. Existing
    jobs keep their original worker and captured settings.
  </p>
  <PluginSettingsRow
    name="Worker Node executable"
    control-id="cf-ps-worker-node"
  >
    <template #description
      >Use <code>node</code> on PATH or a native Node executable path. Node 22
      or later is required. Shell wrappers and Electron's executable are not
      worker runtimes.</template
    >
    <input
      id="cf-ps-worker-node"
      v-model="model.draft.workerNodeBin"
      aria-label="Worker Node executable"
      type="text"
      maxlength="1000"
      placeholder="node"
      spellcheck="false"
      aria-describedby="cf-ps-worker-node-desc"
    />
  </PluginSettingsRow>
  <PluginSettingsRow name="Worker readiness">
    <template #description
      ><span role="status">{{ worker.message }}</span
      ><span v-if="model.workerNodeChanged">
        Save the changed Node path before checking.</span
      >
      This checks the local runtime and worker; it does not start a Build or
      make a paid provider request.</template
    >
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
  </PluginSettingsRow>
  <p v-if="worker.error" class="cf-plugin-settings-error" role="alert">
    {{ worker.error }}
  </p>
  <WorkerStartupRepair :blocked="model.workerNodeChanged" />
  <PluginSettingsRow
    name="Concurrent background Builds"
    control-id="cf-ps-build-slots"
  >
    <template #description
      >Vault-wide Build admission limit, from 1 to 16. Raising it can admit
      queued work. Lowering a limit does not cancel active work; the same idea
      and workspace remain exclusive.</template
    >
    <input
      id="cf-ps-build-slots"
      v-model.number="lanes.builds"
      aria-label="Concurrent background Builds"
      type="number"
      min="1"
      max="16"
      step="1"
      required
      aria-describedby="cf-ps-build-slots-desc"
    />
  </PluginSettingsRow>
  <PluginSettingsRow
    name="Concurrent short tasks"
    control-id="cf-ps-short-slots"
  >
    <template #description
      >Vault-wide foreground/short-task admission limit, from 1 to 16. This
      includes work such as screening, planning and Design. Saved execution
      policies and provider resource caps stay unchanged.</template
    >
    <input
      id="cf-ps-short-slots"
      v-model.number="lanes.shortTasks"
      aria-label="Concurrent short tasks"
      type="number"
      min="1"
      max="16"
      step="1"
      required
      aria-describedby="cf-ps-short-slots-desc"
    />
  </PluginSettingsRow>
</template>
