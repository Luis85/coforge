<script setup lang="ts">
import { useChatComposer } from '../../composables/coforge/use-chat-panel';
import CfIcon from './CfIcon.vue';

const emit = defineEmits<{ sent: [] }>();
const model = useChatComposer(emit);
</script>
<template>
  <div class="cf-chat-compose-area">
    <div class="cf-chat-simulator-control">
      <span>
        <span class="cf-status-dot" :class="{ 'is-active': model.simulating }" />
        {{ model.simulating ? 'Sample chat is running' : 'Try it with sample chat' }}
      </span>
      <button
        type="button" class="cf-icon-button" :aria-label="model.simulating ? 'Pause sample chat' : 'Start sample chat'"
        :title="model.simulating ? 'Pause sample chat' : 'Generate a sample message every 6.5 seconds'" @click="model.toggleSimulation()"
      >
        <CfIcon :name="model.simulating ? 'pause' : 'play'" size="sm" />
      </button>
    </div>
    <form class="cf-chat-composer" @submit.prevent="model.submit()">
      <label class="cf-chat-identity">
        <span>Send as</span>
        <input v-model="model.username" aria-label="Simulated viewer name" maxlength="30" required>
      </label>
      <textarea
        v-model="model.text" aria-label="Chat message" rows="2" :placeholder="model.requestPlaceholder" maxlength="1800"
        @keydown="model.keydown($event)"
      />
      <div class="cf-chat-composer-footer">
        <span>Enter to send</span>
        <button type="submit" class="cf-chat-send-button" :disabled="!model.canSend" aria-label="Send chat message">
          <CfIcon name="send" size="sm" />
        </button>
      </div>
    </form>
    <p v-if="model.error" role="alert" class="cf-inline-error">{{ model.error }}</p>
    <p class="cf-chat-source-note">{{ model.sourceNote }}</p>
  </div>
</template>
