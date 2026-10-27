<script setup lang="ts">
import { usePluginSettingsForm } from '../../composables/coforge/use-plugin-settings';
import CfIcon from './CfIcon.vue';
import PluginSettingsRow from './PluginSettingsRow.vue';
import TwitchAuthorization from './TwitchAuthorization.vue';

const model = usePluginSettingsForm();
</script>
<template>
  <h3 class="cf-setting-heading"><CfIcon name="radio" size="sm" /> Twitch</h3>
  <PluginSettingsRow name="Client ID" description="Your public Twitch application's Client ID." control-id="cf-ps-twitch-client">
    <input id="cf-ps-twitch-client" v-model="model.draft.twitchClientId" type="text" spellcheck="false" autocomplete="off" maxlength="100" aria-describedby="cf-ps-twitch-client-desc">
  </PluginSettingsRow>
  <label class="cf-project-repository-toggle"><input v-model="model.draft.twitchBotUsesStreamer" type="checkbox"><span>Use the streamer account as the chatbot</span></label>
  <TwitchAuthorization :client-id="model.draft.twitchClientId" :uses-streamer="model.draft.twitchBotUsesStreamer" />
  <label class="cf-project-repository-toggle"><input v-model="model.draft.twitchEnabled" type="checkbox"><span>Receive Twitch chat</span></label>
  <label class="cf-project-repository-toggle"><input v-model="model.draft.twitchBotReplies" type="checkbox"><span>Enable automatic bot messages</span></label>
  <p class="cf-settings-help">Save changes to apply these switches. Replies are off by default; connecting an account alone does not enable automatic posts.</p>
  <details class="cf-twitch-advanced"><summary>Advanced: existing user-token configuration</summary>
  <PluginSettingsRow name="Bot user ID" description="Numeric user ID of the account that reads chat — the token’s user." control-id="cf-ps-twitch-bot">
    <input
      id="cf-ps-twitch-bot" v-model="model.draft.twitchBotUserId" type="text" spellcheck="false" autocomplete="off" maxlength="100"
      inputmode="numeric" placeholder="123456" aria-describedby="cf-ps-twitch-bot-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="Broadcaster ID" description="Numeric user ID of the channel whose chat CoForge reads." control-id="cf-ps-twitch-broadcaster">
    <input
      id="cf-ps-twitch-broadcaster" v-model="model.draft.twitchBroadcasterId" type="text" spellcheck="false" autocomplete="off"
      maxlength="100" inputmode="numeric" placeholder="789012" aria-describedby="cf-ps-twitch-broadcaster-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="Token secret name" control-id="cf-ps-twitch-secret">
    <template #description>
      Name of the entry in Obsidian’s secret storage that holds the token. Lowercase letters, digits and dashes.
    </template>
    <input
      id="cf-ps-twitch-secret" v-model="model.draft.twitchTokenSecret" type="text" spellcheck="false" autocomplete="off" maxlength="64"
      required pattern="[a-z0-9\-]+" aria-describedby="cf-ps-twitch-secret-desc"
    >
  </PluginSettingsRow>
  <PluginSettingsRow name="User Access Token" control-id="cf-ps-twitch-token">
    <template #description>
      Stored in Obsidian’s secret storage on this device, never in the vault or in CoForge’s data, and never shown again.
      <span class="cf-plugin-settings-runtime">
        <CfIcon :name="model.tokenStored ? 'key-round' : 'circle-alert'" size="xs" />
        {{ model.tokenStored ? 'A token is stored.' : 'No token is stored yet.' }}
      </span>
      <span v-if="model.tokenError" class="cf-inline-error" role="alert">{{ model.tokenError }}</span>
    </template>
    <div class="cf-plugin-settings-token">
      <input
        id="cf-ps-twitch-token" v-model="model.token" type="password" spellcheck="false" autocomplete="off"
        :placeholder="model.tokenStored ? 'Replace the stored token' : 'Paste the token'" aria-describedby="cf-ps-twitch-token-desc"
        @keydown.enter.prevent="model.saveToken()"
      >
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.token" @click="model.saveToken()">
        <CfIcon name="key-round" size="sm" /> Save token
      </button>
    </div>
  </PluginSettingsRow>
  </details>
</template>
