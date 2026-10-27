<script setup lang="ts">
import { useTwitch } from '../../composables/coforge/use-twitch';
defineProps<{ clientId: string; usesStreamer: boolean }>();
const model = useTwitch();
</script>
<template>
  <div class="cf-twitch-authorization">
    <p role="status">{{ model.state.message }}</p>
    <p class="cf-settings-help">Use a public Twitch application. Authorization opens on twitch.tv; access and refresh tokens stay in Obsidian secret storage.</p>
    <div class="cf-settings-actions">
      <button type="button" class="cf-btn cf-btn-primary" :disabled="!model.supported || !clientId.trim() || model.checking" @click="model.authorize('streamer', clientId, usesStreamer)">{{ model.state.streamer ? 'Reconnect streamer' : 'Connect streamer' }}</button>
      <button v-if="!usesStreamer" type="button" class="cf-btn cf-btn-secondary" :disabled="!model.supported || !clientId.trim() || model.checking" @click="model.authorize('bot', clientId, usesStreamer)">{{ model.state.bot ? 'Reconnect chatbot' : 'Connect chatbot' }}</button>
    </div>
    <p v-if="model.state.streamer">Streamer: <strong>{{ model.state.streamer.login }}</strong></p>
    <p v-if="model.state.bot">Chatbot: <strong>{{ model.state.bot.login }}</strong></p>
    <div v-if="model.state.authorization" class="cf-twitch-device" role="status">
      <strong>Authorize {{ model.state.authorization.role }} on Twitch</strong><code>{{ model.state.authorization.userCode }}</code>
      <a :href="model.state.authorization.verificationUri" target="_blank" rel="noopener noreferrer">Open Twitch authorization</a>
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.cancelAuthorization()">Cancel authorization</button>
      <p>Waiting for approval. This code expires at {{ model.state.authorization.expiresAt }}.</p>
    </div>
    <p v-if="model.error || model.state.lastError" class="cf-inline-error" role="alert">{{ model.error || model.state.lastError }}</p>
    <p v-if="!model.supported" class="cf-settings-help">Connect Twitch from the Obsidian plugin. This preview does not access Twitch accounts.</p>
  </div>
</template>
