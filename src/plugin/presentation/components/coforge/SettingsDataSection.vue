<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';
import ExampleContentCleanup from './ExampleContentCleanup.vue';

const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-data" aria-labelledby="cf-settings-data">
    <div>
      <h2 id="cf-settings-data"><CfIcon name="database" /> Data &amp; examples</h2>
      <p class="cf-settings-help">
        Export a private studio backup of all projects, ideas, plans, settings and activity. The JSON file is written to the CoForge plugin folder.
      </p>
    </div>
    <div class="cf-settings-actions">
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.exportProject()">
        <CfIcon name="download" size="sm" /> Export private studio backup
      </button>
      <button
        type="button" class="cf-btn cf-btn-ghost" :disabled="model.store.busy || model.pending || model.dirty" :aria-expanded="model.resetConfirm"
        aria-controls="cf-settings-reset-confirm" @click="model.toggleReset()"
      >
        <CfIcon name="rotate-ccw" size="sm" /> Load sample workspace
      </button>
    </div>
    <p v-if="model.pending" class="cf-settings-help cf-settings-data-note">
      Cancel, finish or resolve active workflows and Improve &amp; polish passes before loading the sample workspace.
    </p>
    <p v-if="model.dirty" class="cf-settings-help cf-settings-data-note">Save or discard project changes before loading sample content.</p>
    <div v-if="model.resetConfirm" id="cf-settings-reset-confirm" class="cf-settings-reset-confirm" role="group" aria-labelledby="cf-settings-reset-title">
      <div>
        <CfIcon name="triangle-alert" size="lg" />
        <span>
          <strong id="cf-settings-reset-title">{{ model.availableProject ? 'Replace this project’s requests with the sample workspace?' : 'Load the illustrative sample workspace?' }}</strong>
          <p v-if="model.availableProject">
            Your current ideas, votes, plans, and run history will be replaced by the illustrative Mosslight project. Existing idea
            notes for this project are moved to the vault trash, and its automation is paused. Other projects and shared chat are kept.
          </p>
          <p v-else>Create the illustrative Mosslight project and its sample requests in this vault. Automation starts paused. You can preview and remove sample content under these tools.</p>
        </span>
      </div>
      <div class="cf-settings-actions">
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.keepData()">Keep my data</button>
        <button type="button" class="cf-btn cf-btn-danger" :disabled="model.store.busy || model.pending || model.dirty" @click="model.confirmReset()">
          Load sample workspace
        </button>
      </div>
    </div>
    <ExampleContentCleanup />
  </section>
</template>
