<script setup lang="ts">
import { useSettingsForm } from "../../composables/coforge/use-settings";
import CfIcon from "./CfIcon.vue";

const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" aria-labelledby="cf-settings-provider">
    <div class="cf-settings-description">
      <h2 id="cf-settings-provider"><CfIcon name="bot" /> Project defaults</h2>
      <p>
        Steps inherit this provider and model unless you override them below.
      </p>
    </div>
    <div class="cf-settings-fields">
      <fieldset class="cf-settings-provider-choice">
        <legend class="cf-sr-only">Default agent provider</legend>
        <label
          v-for="option in model.providers"
          :key="option.value"
          class="cf-settings-provider-option"
          :class="{ 'is-selected': model.draft.provider === option.value }"
        >
          <input
            v-model="model.draft.provider"
            type="radio"
            name="cf-settings-provider"
            :value="option.value"
            :disabled="model.pending"
          />
          <span class="cf-settings-provider-icon"
            ><CfIcon :name="option.icon" size="lg"
          /></span>
          <span>
            <strong>{{ option.title }}</strong>
            <small>{{ option.text }}</small>
          </span>
          <span class="cf-settings-radio-indicator">
            <CfIcon
              v-if="model.draft.provider === option.value"
              name="check"
              size="xs"
            />
          </span>
        </label>
      </fieldset>
      <p v-if="model.pending" class="cf-settings-help">
        Finish or cancel active and queued runs before changing providers.
      </p>
      <div v-if="model.hasClaudeStep" class="cf-settings-connection-info">
        <div class="cf-settings-connection-status">
          <span
            class="cf-status-dot"
            :class="model.runtime?.cliAvailable ? 'is-active' : 'is-error'"
          />
          <strong>{{
            model.runtime?.cliAvailable
              ? "Claude executable detected"
              : "Claude executable not detected"
          }}</strong>
          <button
            type="button"
            class="cf-btn cf-btn-ghost cf-settings-check"
            :disabled="model.checking"
            @click="model.checkClaude()"
          >
            <CfIcon
              name="refresh-cw"
              size="sm"
              :class="{ 'cf-spin': model.checking }"
            />
            Check Claude Code
          </button>
        </div>
        <p>
          Install and sign in to Claude Code locally (<code
            >claude auth login</code
          >). Set the executable, your game repository and implementation
          permission in this project's <strong>Agent workspace</strong> section.
          The CLI executable is configured in Obsidian's CoForge settings.
        </p>
        <p>
          The check only reads the CLI version. It makes no model request and
          does not prove that you are signed in.
        </p>
      </div>
      <div v-if="model.hasHerdrStep" class="cf-settings-connection-info">
        <div class="cf-settings-connection-status">
          <span
            class="cf-status-dot"
            :class="
              model.runtime?.herdrWorkflow?.ready ? 'is-active' : 'is-error'
            "
          /><strong>{{
            model.runtime?.herdrWorkflow?.ready
              ? "Herdr workflow ready"
              : "Herdr workflow unavailable"
          }}</strong>
        </div>
        <p>
          {{
            model.runtime?.herdrWorkflow?.message ||
            "Check and configure the Herdr connection on Agent workflow inside Obsidian. Browser previews cannot launch native agents."
          }}
        </p>
        <p>
          Every Herdr step requires a project path. Build also requires
          implementation permission. CoForge launches a dedicated managed Claude
          Code agent per attempt and validates its correlated result artifact.
        </p>
      </div>
      <label v-if="model.draft.provider === 'herdr'" class="cf-field"
        ><span>Default Herdr agent type</span
        ><select v-model="model.draft.herdrAgent" :disabled="model.pending">
          <option :value="undefined">Claude Code (default)</option>
          <option value="claude">Claude Code (explicit)</option></select
        ><small
          >The verified managed profile currently supports Claude Code
          only.</small
        ></label
      >
      <label class="cf-field">
        <span>Default agent model</span>
        <input
          v-model="model.draft.model"
          type="text"
          maxlength="100"
          required
          placeholder="sonnet"
          pattern="[a-zA-Z0-9][a-zA-Z0-9._:\-]{0,99}"
          aria-describedby="cf-settings-model-help"
        />
        <small id="cf-settings-model-help"
          >A Claude Code model alias such as sonnet or opus. Real steps inherit
          it when no step model is set; Simulation makes no model call.</small
        >
      </label>
    </div>
  </section>
</template>
