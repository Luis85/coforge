<script setup lang="ts">
import type { StreamSurfaceSnapshot } from "../../../features/coforge/domain/stream-surfaces";
import { useStreamChat } from "../../composables/coforge/use-stream-chat";
const props = defineProps<{ chat: StreamSurfaceSnapshot["chat"] }>();
const model = useStreamChat(props);
</script>
<template>
  <section class="cf-stream-live-chat" aria-label="Public Twitch chat">
    <p class="cf-stream-chat-state">
      <span
        :class="{ 'is-connected': chat.connected }"
        aria-hidden="true"
      ></span
      >{{ chat.connected ? "Live Twitch chat" : "Waiting for Twitch chat" }}
    </p>
    <div
      :ref="model.bind"
      class="cf-stream-chat-viewport"
      tabindex="0"
      role="region"
      aria-label="Live Twitch message history"
    >
      <div v-if="!chat.connected" class="cf-stream-chat-wait">
        <h2>The conversation starts here</h2>
        <p>Messages appear when the live Twitch connection is ready.</p>
        <p>
          Join the community with <code>!register</code>. Ask
          <code>!help</code> how to take part.
        </p>
      </div>
      <p v-else-if="!chat.messages.length" class="cf-stream-empty">
        Say hello in Twitch chat. Your message will appear here.
      </p>
      <ol class="cf-stream-chat" aria-label="Live Twitch messages">
        <li v-for="message in chat.messages" :key="message.key">
          <div>
            <strong>{{ message.name }}</strong
            ><time :datetime="message.at">{{ model.time(message.at) }}</time>
          </div>
          <p>{{ message.text }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
