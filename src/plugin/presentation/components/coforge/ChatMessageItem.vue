<script setup lang="ts">
import type { ChatMessageView } from '../../composables/coforge/use-chat-panel';
import CfIcon from './CfIcon.vue';

defineProps<{ message: ChatMessageView }>();
defineEmits<{ select: [ideaId: string] }>();
</script>
<template>
  <div class="cf-chat-message" :class="{ 'is-bot': message.bot, 'is-error': message.error }">
    <span v-if="message.bot" class="cf-chat-bot-mark"><CfIcon name="sparkles" size="xs" /></span>
    <span v-else class="cf-avatar cf-avatar-sm" :style="message.avatar">{{ message.initials }}</span>
    <div class="cf-chat-message-content">
      <div class="cf-chat-message-author">
        <strong :style="message.nameStyle">{{ message.author }}</strong>
        <span v-if="message.bot" class="cf-chat-bot-tag">BOT</span>
        <span v-else class="cf-chat-message-source">{{ message.source }}</span>
        <time :datetime="message.dateTime">{{ message.time }}</time>
      </div>
      <p :class="{ 'cf-chat-command': message.command }">{{ message.text }}</p>
      <button v-if="message.ideaId" type="button" class="cf-chat-idea-link" @click="$emit('select', message.ideaId)">
        View {{ message.ideaId }}
        <CfIcon name="arrow-up-right" size="xs" />
      </button>
    </div>
  </div>
</template>
