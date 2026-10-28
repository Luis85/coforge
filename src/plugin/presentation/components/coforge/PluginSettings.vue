<script setup lang="ts">
import { usePluginSettings } from "../../composables/coforge/use-plugin-settings";
import CfIcon from "./CfIcon.vue";
import PluginSettingsClaude from "./PluginSettingsClaude.vue";
import PluginSettingsRow from "./PluginSettingsRow.vue";
import PluginSettingsTwitch from "./PluginSettingsTwitch.vue";
import PluginSettingsWebsite from "./PluginSettingsWebsite.vue";

const model = usePluginSettings();
</script>
<template>
  <div class="cf-plugin-settings">
    <div v-if="!model.ready" class="cf-plugin-settings-loading">
      <p v-if="model.failure" role="alert">
        <CfIcon name="circle-alert" size="sm" /> {{ model.failure }}
      </p>
      <p v-else role="status">
        <CfIcon name="loader-circle" size="sm" class="cf-spin" /> CoForge is
        still loading…
      </p>
    </div>
    <form v-else class="cf-plugin-settings-form" @submit="model.submit">
      <p class="cf-plugin-settings-intro">
        These settings are saved with the plugin in this vault’s configuration
        folder; the Twitch token is kept in Obsidian’s secret storage. Configure
        the project brief and workspace under <strong>Project settings</strong>;
        configure agent providers, models, prompts and run limits under
        <strong>Workflow settings</strong>.
      </p>
      <h3 class="cf-setting-heading">
        <CfIcon name="folder" size="sm" /> Vault
      </h3>
      <PluginSettingsRow name="Ideas folder" control-id="cf-ps-ideas-folder">
        <template #description>
          Vault-relative folder that holds one Markdown note per idea. When you
          change it, existing idea notes are moved to the new folder.
          <span
            v-if="model.folderChanged && model.pending"
            class="cf-plugin-settings-warning"
          >
            Finish or cancel queued runs before moving the ideas folder.
          </span>
        </template>
        <input
          id="cf-ps-ideas-folder"
          v-model="model.draft.ideasFolder"
          type="text"
          spellcheck="false"
          maxlength="200"
          required
          placeholder="CoForge/Ideas"
          aria-describedby="cf-ps-ideas-folder-desc"
        />
      </PluginSettingsRow>
      <PluginSettingsClaude />
      <PluginSettingsTwitch />
      <PluginSettingsWebsite />
      <div class="cf-plugin-settings-save">
        <div
          v-if="model.error"
          class="cf-plugin-settings-message is-error"
          role="alert"
        >
          <CfIcon name="circle-alert" size="sm" />
          <span>{{ model.error }}</span>
        </div>
        <span v-else class="cf-plugin-settings-status" aria-live="polite">
          <template v-if="model.dirty">You have unsaved changes.</template>
          <template v-else-if="model.justSaved"
            ><CfIcon name="circle-check" size="sm" /> Integration settings
            saved</template
          >
          <template v-else>All changes saved.</template>
        </span>
        <div class="cf-plugin-settings-buttons">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="!model.dirty"
            @click="model.revert()"
          >
            Discard changes
          </button>
          <button
            type="submit"
            class="cf-btn cf-btn-primary"
            :disabled="model.store.busy || !model.dirty"
          >
            <CfIcon name="save" size="sm" /> Save changes
          </button>
        </div>
      </div>
    </form>
    <div
      v-if="model.notice && model.notice.message !== model.error"
      class="cf-plugin-settings-message"
      :class="{ 'is-error': model.notice.error }"
      role="status"
      aria-live="polite"
    >
      <CfIcon :name="model.notice.error ? 'circle-alert' : 'check'" size="sm" />
      <span>{{ model.notice.message }}</span>
      <button
        type="button"
        class="cf-icon-button"
        aria-label="Dismiss message"
        @click="model.store.dismiss(model.notice.id)"
      >
        <CfIcon name="x" size="sm" />
      </button>
    </div>
  </div>
</template>
