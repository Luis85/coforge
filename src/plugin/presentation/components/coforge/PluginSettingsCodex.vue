<script setup lang="ts">
import { usePluginSettingsForm } from '../../composables/coforge/use-plugin-settings';
import PluginSettingsRow from './PluginSettingsRow.vue';
const model = usePluginSettingsForm();
</script>
<template>
  <h3 class="cf-setting-heading">Codex CLI</h3>
  <p class="cf-plugin-settings-section-intro">Install Codex CLI 0.145 or later and sign in with <code>codex login</code> in your terminal. Select Codex in workflow settings or a CoWorker definition. CoForge uses your local account; credentials are not saved in definitions.</p>
  <PluginSettingsRow name="Codex executable" control-id="cf-ps-codex-bin">
    <template #description>Use <code>codex</code> on PATH or an absolute native executable path. On Windows, CoForge also locates the native executable inside a standard npm installation; shell wrappers are not executed.</template>
    <input id="cf-ps-codex-bin" v-model="model.draft.codexBin" type="text" maxlength="1000" placeholder="codex" spellcheck="false" aria-describedby="cf-ps-codex-bin-desc" />
  </PluginSettingsRow>
  <PluginSettingsRow name="Check Codex">
    <template #description>{{ model.runtime?.codexAvailable ? 'Codex CLI is available.' : 'Codex CLI is unavailable or too old.' }} Save a changed path before checking. Only the installed version is read; no model request is made.</template>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.checking" @click="model.checkClaude()">Check Codex</button>
  </PluginSettingsRow>
</template>
