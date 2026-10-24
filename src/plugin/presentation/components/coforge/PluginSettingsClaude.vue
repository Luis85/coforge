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
    <strong>Claude Code CLI</strong> as the agent provider in the studio’s Studio settings. CLI and provider terms and usage limits apply.
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
  <PluginSettingsRow name="Game repository" control-id="cf-ps-project-path">
    <template #description>
      Absolute path to a trusted local Git repository with at least one commit, for example <code>C:/Projects/my-game</code> or
      <code>/Users/you/Projects/my-game</code>. Planning reads its source; screening and scoring do not need it.
    </template>
    <input
      id="cf-ps-project-path" v-model="model.draft.projectPath" type="text" spellcheck="false" maxlength="1000"
      placeholder="/absolute/path/to/my-game" aria-describedby="cf-ps-project-path-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="Worktree folder" control-id="cf-ps-worktree-folder">
    <template #description>
      Optional absolute folder for build worktrees. Leave empty to use <code class="cf-plugin-settings-path">{{ model.worktreeDefault }}</code>
      next to the repository. Failed or cancelled builds keep their worktree so no work is lost; clean them up with Git.
    </template>
    <input
      id="cf-ps-worktree-folder" v-model="model.draft.worktreeFolder" type="text" spellcheck="false" maxlength="1000"
      placeholder="Optional" aria-describedby="cf-ps-worktree-folder-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="Allow real implementation" control-id="cf-ps-allow-implementation">
    <template #description>
      Lets the Build stage edit game files with Claude Code. The repository needs a clean working tree.
    </template>
    <label class="cf-plugin-settings-toggle" :class="{ 'is-enabled': model.draft.allowImplementation }">
      <input
        id="cf-ps-allow-implementation" v-model="model.draft.allowImplementation" type="checkbox" role="switch"
        aria-describedby="cf-ps-allow-implementation-desc cf-ps-allow-implementation-warning"
      >
      <span aria-hidden="true" />
    </label>
  </PluginSettingsRow>
  <div id="cf-ps-allow-implementation-warning" class="cf-plugin-settings-callout" :class="{ 'is-active': model.draft.allowImplementation }">
    <CfIcon name="shield-alert" />
    <div>
      <strong>Review every increment before you run it.</strong>
      <p>
        Each build edits a new branch in a separate Git worktree; your normal checkout stays untouched. CoForge never commits, merges,
        pushes or deploys — accepting an increment only records your review. The agent has no shell, so it runs no tests or builds.
      </p>
      <p>
        <strong>A Git worktree is not a sandbox.</strong> File boundaries rely on Claude Code’s tool restrictions. Use a trusted
        repository without secrets, and remember that screening community requests is a moderation signal, not proof that they are safe.
      </p>
    </div>
  </div>
</template>
