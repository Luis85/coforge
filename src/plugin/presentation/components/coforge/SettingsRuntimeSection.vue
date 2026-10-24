<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';

const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-runtime" aria-labelledby="cf-settings-runtime">
    <div class="cf-settings-runtime-heading">
      <h2 id="cf-settings-runtime"><CfIcon name="plug" /> Local connections</h2>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.checking" @click="model.checkClaude()">
        <CfIcon name="refresh-cw" size="sm" :class="{ 'cf-spin': model.checking }" /> Check Claude Code
      </button>
    </div>
    <dl class="cf-settings-runtime-list">
      <div>
        <dt>Agent executable</dt>
        <dd>
          <span class="cf-status-dot" :class="{ 'is-active': model.runtime?.cliAvailable }" />
          {{ model.runtime?.cliAvailable ? 'Available' : 'Not detected' }}
        </dd>
      </div>
      <div>
        <dt>Game repository</dt>
        <dd class="cf-mono">{{ model.runtime?.projectPath || 'Not configured · set it in the CoForge plugin settings' }}</dd>
      </div>
      <div>
        <dt>Real implementation</dt>
        <dd>
          <span class="cf-status-dot" :class="{ 'is-active': model.runtime?.allowImplementation }" />
          {{ model.runtime?.allowImplementation ? 'Enabled in the plugin settings' : 'Disabled in the plugin settings' }}
        </dd>
      </div>
      <div>
        <dt>Community chat</dt>
        <dd>{{ model.runtime?.chatSource === 'twitch' ? 'Twitch · ' : 'Simulator · ' }}{{ model.runtime?.chatStatus }}</dd>
      </div>
    </dl>
    <p class="cf-settings-help">
      The Claude Code executable, game repository, implementation permission and Twitch connection are configured in
      <strong>Settings → Community plugins → CoForge</strong>. Tokens stay in Obsidian’s secret storage, never in the vault.
    </p>
  </section>
</template>
