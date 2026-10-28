<script setup lang="ts">
import { useTwitch } from "../../composables/coforge/use-twitch";
import TwitchAuthorization from "./TwitchAuthorization.vue";
import TwitchChannelEditor from "./TwitchChannelEditor.vue";
const model = useTwitch();
</script>
<template>
  <section class="cf-twitch-controls" aria-label="Twitch channel controls">
    <header>
      <div>
        <h2>{{ model.state.channel?.name || "Twitch channel" }}</h2>
        <p role="status">{{ model.state.message }}</p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.checking"
        @click="model.reconnect()"
      >
        Reconnect
      </button>
    </header>
    <details class="cf-twitch-setup" :open="!model.state.bot">
      <summary>Connection settings</summary>
      <label class="cf-field"
        ><span>Twitch application Client ID</span
        ><input
          v-model="model.connection.twitchClientId"
          type="text"
          maxlength="100"
          autocomplete="off"
      /></label>
      <label class="cf-project-repository-toggle"
        ><input
          v-model="model.connection.twitchBotUsesStreamer"
          type="checkbox"
        /><span>Use the streamer account as the chatbot</span></label
      >
      <TwitchAuthorization
        :client-id="model.connection.twitchClientId"
        :uses-streamer="model.connection.twitchBotUsesStreamer"
      />
      <label class="cf-project-repository-toggle"
        ><input v-model="model.connection.twitchEnabled" type="checkbox" /><span
          >Receive Twitch chat</span
        ></label
      >
      <label class="cf-project-repository-toggle"
        ><input
          v-model="model.connection.twitchBotReplies"
          type="checkbox"
        /><span>Enable automatic bot messages</span></label
      >
      <p>
        Allows registration greetings, command replies and activated recurring
        messages.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.checking"
        @click="model.saveConnection()"
      >
        Save Twitch connection
      </button>
    </details>
    <p v-if="!model.state.streamer" class="cf-settings-help">
      Connect the streamer account in Twitch settings to edit the channel and
      moderate chat.
    </p>
    <TwitchChannelEditor />
    <p v-if="model.error" class="cf-inline-error" role="alert">
      {{ model.error }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
    <details v-if="model.replies.length">
      <summary>
        Bot delivery needs attention ({{ model.replies.length }})
      </summary>
      <div
        v-for="reply in model.replies"
        :key="reply.id"
        class="cf-twitch-reply"
      >
        <strong>{{
          reply.status === "uncertain" ? "Delivery unconfirmed" : "Not sent"
        }}</strong>
        <p>{{ reply.error }}</p>
        <button
          v-if="reply.status === 'failed' && !reply.streamMessageId"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.checking"
          @click="model.retry(reply.id)"
        >
          Retry reply</button
        ><button
          v-if="reply.streamMessageId"
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.openStreamMessages()"
        >
          Review recurring message
        </button>
      </div>
    </details>
  </section>
</template>
