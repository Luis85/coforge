<script setup lang="ts">
import { useSettings } from '../../composables/coforge/use-settings';
import CfIcon from './CfIcon.vue';
import SettingsDataSection from './SettingsDataSection.vue';
import SettingsNumberSection from './SettingsNumberSection.vue';
import SettingsProviderSection from './SettingsProviderSection.vue';
import SettingsRuntimeSection from './SettingsRuntimeSection.vue';
import SettingsRepositorySection from './SettingsRepositorySection.vue';
import SettingsStagePrompts from './SettingsStagePrompts.vue';

const model = useSettings();
</script>
<template>
  <div class="cf-settings-page">
    <header class="cf-page-heading">
      <div>
        <h1>Project settings</h1>
        <p>Configure {{ model.draft.projectName }}. Each project keeps its own brief, workspace and workflow.</p>
      </div>
      <span class="cf-settings-local-label"><CfIcon name="shield-check" size="sm" /> Local workspace</span>
    </header>
    <form class="cf-settings-form" @submit="model.submit">
      <div v-if="model.error" class="cf-settings-alert is-error" role="alert">
        <CfIcon name="circle-alert" />
        <span>{{ model.error }}</span>
      </div>
      <section class="cf-settings-section" aria-labelledby="cf-settings-game">
        <div class="cf-settings-description">
          <h2 id="cf-settings-game"><CfIcon name="folder-git-2" /> The game</h2>
          <p>The brief gives the scoring and planning agents a shared direction.</p>
        </div>
        <div class="cf-settings-fields">
          <label class="cf-field">
            <span>Project name</span>
            <input v-model="model.draft.projectName" type="text" maxlength="80" required placeholder="Mosslight">
          </label>
          <label class="cf-field">
            <span>Description</span>
            <textarea
              v-model="model.draft.projectBrief" minlength="10" maxlength="8000" rows="5" required
              placeholder="Describe the game, its audience, mechanics, and what you are building next."
              aria-describedby="cf-settings-brief-help"
            />
            <small id="cf-settings-brief-help">Include design goals, scope boundaries, and the kind of experience you want to build.</small>
          </label>
          <label class="cf-field"><span>General agent prompt</span><textarea v-model="model.draft.agentPrompt" aria-label="General agent prompt" maxlength="8000" rows="5" aria-describedby="cf-settings-agent-prompt-help" placeholder="Project conventions and instructions for every agent dispatch" /><small id="cf-settings-agent-prompt-help">Prefixed to every dispatch for this project. Agent tool restrictions and worktree boundaries still apply.</small></label>
        </div>
      </section>
      <SettingsProviderSection />
      <SettingsStagePrompts />
      <SettingsRepositorySection />
      <p class="cf-settings-help">Viewer feature requests have a fixed 5-minute cooldown across all projects. Registration and earning rules are managed under Players and Operations.</p>
      <SettingsNumberSection
        :fields="model.rhythm" icon="sliders-horizontal" heading="Workflow rhythm"
        text="Stage automation switches are on the Agent workflow screen. These limits apply to the queue."
      >
        <p class="cf-settings-note">
          <CfIcon name="shield-check" size="sm" />
          <span>Review of a finished increment always stays with you.</span>
        </p>
      </SettingsNumberSection>
      <SettingsNumberSection
        :fields="model.limits" icon="gauge" heading="Run limits"
        text="Bound each real CLI invocation. A failed run waits for your attention before retrying."
      >
        <p class="cf-settings-help">These limits are sent to the local CLI. The provider controls billing and account usage.</p>
      </SettingsNumberSection>
      <div class="cf-settings-save">
        <span class="cf-settings-help" aria-live="polite">
          <template v-if="model.status === 'saved'"><CfIcon name="circle-check" size="sm" /> Settings saved</template>
          <template v-else-if="model.status === 'dirty'">You have unsaved changes.</template>
          <template v-else>All changes saved in this vault.</template>
        </span>
        <div class="cf-settings-actions">
          <button class="cf-btn cf-btn-secondary" type="button" :disabled="model.store.busy || !model.dirty" @click="model.discard()">Discard changes</button>
          <button class="cf-btn cf-btn-primary" type="submit" :disabled="model.store.busy || !model.dirty"><CfIcon name="save" size="sm" /> Save settings</button>
        </div>
      </div>
    </form>
    <SettingsRuntimeSection />
    <SettingsDataSection />
  </div>
</template>
