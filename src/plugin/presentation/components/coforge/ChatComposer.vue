<script setup lang="ts">
import { useChatComposer } from '../../composables/coforge/use-chat-panel';
import CfIcon from './CfIcon.vue';
const emit = defineEmits<{ sent: [] }>();
const model = useChatComposer(emit);
</script>
<template>
  <div class="cf-chat-compose-area">
    <div v-if="!model.live && !model.testing" class="cf-chat-offline">
      <p>Twitch chat is not connected.</p>
      <button type="button" class="cf-btn cf-btn-secondary" @click="model.store.navigate('stream')">Configure Twitch</button>
      <button type="button" class="cf-btn cf-btn-ghost" @click="model.testLocally()">Test commands locally</button>
    </div>
    <template v-else>
      <div v-if="model.testing" class="cf-chat-simulator-control"><span>Local command test · start with !register</span><button type="button" class="cf-btn cf-btn-ghost" @click="model.stopTesting()">End local test</button></div>
      <p v-else class="cf-settings-help">Sending as {{ model.botName }}</p>
      <form class="cf-chat-composer" @submit.prevent="model.submit()">
        <label v-if="model.testing" class="cf-chat-identity"><span>Test viewer name</span><input v-model="model.username" aria-label="Simulated viewer name" maxlength="30" required></label>
        <textarea v-model="model.text" aria-label="Chat message" rows="2" :placeholder="model.testing ? model.requestPlaceholder : 'Message the channel'" :maxlength="model.live && !model.testing ? 500 : 1800" @keydown="model.keydown($event)" />
        <div class="cf-chat-composer-footer"><span>Enter to send</span><button type="submit" class="cf-chat-send-button" :disabled="!model.canSend" aria-label="Send chat message"><CfIcon name="send" size="sm" /></button></div>
      </form>
      <p class="cf-chat-source-note">{{ model.sourceNote }}</p>
    </template>
    <p v-if="model.error" role="alert" class="cf-inline-error">{{ model.error }}</p>
  </div>
</template>
