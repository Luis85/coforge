<script setup lang="ts">
import { useSettingsForm } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';

const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" aria-labelledby="cf-settings-provider">
    <div class="cf-settings-description">
      <h2 id="cf-settings-provider"><CfIcon name="bot" /> Agent provider</h2>
      <p>Explore the full workflow, then connect it to your local game repository.</p>
    </div>
    <div class="cf-settings-fields">
      <fieldset class="cf-settings-provider-choice">
        <legend class="cf-sr-only">Choose an agent provider</legend>
        <label
          v-for="option in model.providers" :key="option.value" class="cf-settings-provider-option"
          :class="{ 'is-selected': model.draft.provider === option.value }"
        >
          <input v-model="model.draft.provider" type="radio" name="cf-settings-provider" :value="option.value" :disabled="model.pending">
          <span class="cf-settings-provider-icon"><CfIcon :name="option.icon" size="lg" /></span>
          <span>
            <strong>{{ option.title }}</strong>
            <small>{{ option.text }}</small>
          </span>
          <span class="cf-settings-radio-indicator">
            <CfIcon v-if="model.draft.provider === option.value" name="check" size="xs" />
          </span>
        </label>
      </fieldset>
      <p v-if="model.pending" class="cf-settings-help">Finish or cancel active and queued runs before changing providers.</p>
      <div v-if="model.draft.provider === 'claude'" class="cf-settings-connection-info">
        <div class="cf-settings-connection-status">
          <span class="cf-status-dot" :class="model.runtime?.cliAvailable ? 'is-active' : 'is-error'" />
          <strong>{{ model.runtime?.cliAvailable ? 'Claude executable detected' : 'Claude executable not detected' }}</strong>
          <button type="button" class="cf-btn cf-btn-ghost cf-settings-check" :disabled="model.checking" @click="model.checkClaude()">
            <CfIcon name="refresh-cw" size="sm" :class="{ 'cf-spin': model.checking }" /> Check Claude Code
          </button>
        </div>
        <p>
          Install and sign in to Claude Code locally (<code>claude auth login</code>). Set the executable, your game repository and
          implementation permission in <strong>Settings → Community plugins → CoForge</strong>.
        </p>
        <p>The check only reads the CLI version. It makes no model request and does not prove that you are signed in.</p>
      </div>
      <label class="cf-field">
        <span>Claude model</span>
        <input
          v-model="model.draft.model" type="text" maxlength="100" required placeholder="sonnet" pattern="[a-zA-Z0-9._:\-]+"
          aria-describedby="cf-settings-model-help"
        >
        <small id="cf-settings-model-help">A CLI model alias such as sonnet or opus. Used for real agent runs.</small>
      </label>
    </div>
  </section>
</template>
