<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';

const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-data" aria-labelledby="cf-settings-data">
    <div>
      <h2 id="cf-settings-data"><CfIcon name="settings-2" /> Project data</h2>
      <p class="cf-settings-help">
        Export a private studio backup of all projects, ideas, plans, settings and activity. The JSON file is written to the CoForge plugin folder.
      </p>
    </div>
    <div class="cf-settings-actions">
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.exportProject()">
        <CfIcon name="download" size="sm" /> Export JSON
      </button>
      <button
        type="button" class="cf-btn cf-btn-ghost" :disabled="model.store.busy || model.pending" :aria-expanded="model.resetConfirm"
        aria-controls="cf-settings-reset-confirm" @click="model.toggleReset()"
      >
        <CfIcon name="rotate-ccw" size="sm" /> Load sample workspace
      </button>
    </div>
    <p v-if="model.pending" class="cf-settings-help cf-settings-data-note">
      Cancel or finish active and queued runs before loading the sample workspace.
    </p>
    <div v-if="model.resetConfirm" id="cf-settings-reset-confirm" class="cf-settings-reset-confirm" role="group" aria-labelledby="cf-settings-reset-title">
      <div>
        <CfIcon name="triangle-alert" size="lg" />
        <span>
          <strong id="cf-settings-reset-title">Replace this project’s requests with the sample workspace?</strong>
          <p>
            Your current ideas, votes, plans, and run history will be replaced by the illustrative Mosslight project. Existing idea
            notes for this project are moved to the vault trash, and its automation is paused. Other projects and shared chat are kept.
          </p>
        </span>
      </div>
      <div class="cf-settings-actions">
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.keepData()">Keep my data</button>
        <button type="button" class="cf-btn cf-btn-danger" :disabled="model.store.busy || model.pending" @click="model.confirmReset()">
          Load sample workspace
        </button>
      </div>
    </div>
  </section>
</template>
