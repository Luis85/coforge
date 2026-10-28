<script setup lang="ts">
import { usePluginSettingsForm } from '../../composables/coforge/use-plugin-settings';
import CfIcon from './CfIcon.vue';
import PluginSettingsRow from './PluginSettingsRow.vue';

const model = usePluginSettingsForm();
</script>
<template>
  <h3 class="cf-setting-heading"><CfIcon name="bot" size="sm" /> Claude Code</h3>
  <p class="cf-plugin-settings-section-intro">
    Install the native Claude Code CLI and sign in from your own terminal with <code>claude auth login</code>. Then choose
    <strong>Claude Code</strong> for the project's AI steps in <strong>Workflow settings</strong>. CLI and provider terms and usage limits apply.
  </p>
  <PluginSettingsRow name="Claude Code executable" control-id="cf-ps-claude-bin">
    <template #description>
      <code>claude</code> when it is on your PATH, otherwise the absolute path to the native executable (on Windows
      <code>claude.exe</code>). npm <code>.cmd</code> or <code>.bat</code> wrappers do not work: CoForge never starts the CLI through a shell.
      <span v-if="model.wrapperWarning" class="cf-plugin-settings-warning">This looks like a shell wrapper. Point to the native executable instead.</span>
    </template>
    <input
      id="cf-ps-claude-bin" v-model="model.draft.claudeBin" type="text" spellcheck="false" maxlength="1000" required placeholder="claude"
      aria-describedby="cf-ps-claude-bin-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="Check Claude Code">
    <template #description>
      <span class="cf-plugin-settings-runtime">
        <span class="cf-status-dot" :class="model.runtime?.cliAvailable ? 'is-active' : 'is-error'" />
        {{ model.runtime?.cliAvailable ? 'Claude Code CLI is available.' : 'Claude Code CLI was not found or is too old.' }}
      </span>
      Only the CLI version is read. No model request is made, and the check does not prove that you are signed in. Save a changed
      executable path before checking it.
    </template>
    <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.checking" @click="model.checkClaude()">
      <CfIcon name="refresh-cw" size="sm" :class="{ 'cf-spin': model.checking }" /> Check Claude Code
    </button>
  </PluginSettingsRow>
  <p class="cf-plugin-settings-section-intro">Each project’s repository, worktree folder and implementation permission are configured in its Project settings in the studio.</p>
</template>
