<script setup lang="ts">
import { usePluginSettings } from "../../composables/coforge/use-plugin-settings";
import CfIcon from "./CfIcon.vue";
import PluginSettingsClaude from "./PluginSettingsClaude.vue";
import PluginSettingsCodex from './PluginSettingsCodex.vue';
import PluginSettingsWorker from './PluginSettingsWorker.vue';
import PluginSettingsMcp from "./PluginSettingsMcp.vue";
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
      <h2>Vault integrations</h2>
      <p class="cf-plugin-settings-intro">
        Connect the tools shared by this vault. Twitch tokens stay in Obsidian’s
        secret storage.
      </p>
      <dl
        class="cf-plugin-settings-ownership"
        aria-label="Where settings belong"
      >
        <div>
          <dt>Here</dt>
          <dd>Vault folders, Claude Code, local MCP, Twitch and the viewer website.</dd>
        </div>
        <div>
          <dt>Project settings</dt>
          <dd>
            The selected game’s brief, repository and implementation permission.
          </dd>
        </div>
        <div>
          <dt>Workflow settings</dt>
          <dd>
            Agent providers, models, prompts and run limits for each project,
            under Agent workflow → Idea Board Workflow.
          </dd>
        </div>
      </dl>
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
      <PluginSettingsCodex />
      <PluginSettingsWorker />
      <PluginSettingsMcp />
      <PluginSettingsTwitch />
      <PluginSettingsWebsite />
      <div
        v-if="model.notice && model.notice.message !== model.error"
        class="cf-plugin-settings-message"
        :class="{ 'is-error': model.notice.error }"
      >
        <CfIcon :name="model.notice.error ? 'circle-alert' : 'check'" size="sm" />
        <span class="cf-notice-body" :role="model.notice.error ? 'alert' : 'status'" aria-atomic="true">{{ model.notice.message }}</span>
        <button
          type="button"
          class="cf-icon-button"
          aria-label="Dismiss message"
          @click="model.store.dismiss(model.notice.id)"
        >
          <CfIcon name="x" size="sm" />
        </button>
      </div>
      <div class="cf-plugin-settings-save">
        <div
          v-if="model.error"
          class="cf-plugin-settings-message is-error"
          role="alert"
        >
          <CfIcon name="circle-alert" size="sm" />
          <span class="cf-notice-body">{{ model.error }}</span>
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
  </div>
</template>
