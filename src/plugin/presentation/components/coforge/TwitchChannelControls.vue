<script setup lang="ts">
import { useTwitch } from '../../composables/coforge/use-twitch';
import TwitchAuthorization from './TwitchAuthorization.vue';
const model = useTwitch();
</script>
<template>
  <section class="cf-twitch-controls" aria-label="Twitch channel controls">
    <header><div><h2>{{ model.state.channel?.name || 'Twitch channel' }}</h2><p role="status">{{ model.state.message }}</p></div>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.supported || model.checking" @click="model.reconnect()">Reconnect</button>
    </header>
    <details class="cf-twitch-setup" :open="!model.state.bot">
      <summary>Connection settings</summary>
      <label class="cf-field"><span>Twitch application Client ID</span><input v-model="model.connection.twitchClientId" type="text" maxlength="100" autocomplete="off"></label>
      <label class="cf-project-repository-toggle"><input v-model="model.connection.twitchBotUsesStreamer" type="checkbox"><span>Use the streamer account as the chatbot</span></label>
      <TwitchAuthorization :client-id="model.connection.twitchClientId" :uses-streamer="model.connection.twitchBotUsesStreamer" />
      <label class="cf-project-repository-toggle"><input v-model="model.connection.twitchEnabled" type="checkbox"><span>Receive Twitch chat</span></label>
      <label class="cf-project-repository-toggle"><input v-model="model.connection.twitchBotReplies" type="checkbox"><span>Enable automatic chatbot command replies</span></label>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.supported || model.checking" @click="model.saveConnection()">Save Twitch connection</button>
    </details>
    <p v-if="!model.state.streamer" class="cf-settings-help">Connect the streamer account in Twitch settings to edit the channel and moderate chat.</p>
    <form @submit="model.saveChannel">
      <fieldset :disabled="!model.state.canManage || model.checking">
        <legend>Channel details</legend>
        <label class="cf-field"><span>Stream title</span><input v-model="model.title" type="text" maxlength="140" required></label>
        <div class="cf-twitch-category-search"><label class="cf-field"><span>Find a category</span><input v-model="model.categoryQuery" type="search" maxlength="100"></label><button type="button" class="cf-btn cf-btn-secondary" @click="model.search()">Search categories</button></div>
        <label class="cf-field"><span>Category</span><select v-model="model.categoryId"><option :value="model.state.channel?.categoryId || ''">{{ model.state.channel?.categoryName || 'No category' }}</option><option v-for="category in model.categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
        <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-secondary" @click="model.refresh()">Refresh channel</button><button type="submit" class="cf-btn cf-btn-primary">Save channel details</button></div>
      </fieldset>
    </form>
    <details class="cf-twitch-moderation" :open="Boolean(model.store.moderationTarget)">
      <summary>Moderation</summary>
      <form @submit="model.prepareModeration">
        <fieldset :disabled="!model.state.canModerate || model.checking">
          <legend>Review a moderation action</legend>
          <label class="cf-field"><span>Action</span><select v-model="model.moderation.action"><option value="delete">Delete one message</option><option value="timeout">Time out a viewer</option><option value="ban">Ban a viewer</option></select></label>
          <label v-if="model.moderation.action === 'delete'" class="cf-field"><span>Twitch message ID</span><input v-model="model.moderation.messageId" type="text" required maxlength="200"></label>
          <template v-else>
            <label class="cf-field"><span>Twitch username</span><input v-model="model.moderation.login" type="text" required maxlength="25" autocomplete="off"></label>
            <label v-if="model.moderation.action === 'timeout'" class="cf-field"><span>Timeout in seconds</span><input v-model.number="model.moderation.duration" type="number" min="1" max="1209600" required></label>
            <label class="cf-field"><span>Reason (optional)</span><input v-model="model.moderation.reason" type="text" maxlength="500"></label>
          </template>
          <button type="submit" class="cf-btn cf-btn-secondary">Review action</button>
        </fieldset>
      </form>
      <div v-if="model.confirmation" class="cf-twitch-confirmation" role="group" aria-label="Confirm moderation">
        <p>{{ model.confirmation.text }}</p>
        <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-secondary" @click="model.cancelModeration()">Cancel</button><button type="button" class="cf-btn cf-btn-danger" :disabled="model.checking" @click="model.confirmModeration()">Confirm action</button></div>
      </div>
    </details>
    <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p><p v-if="model.notice" role="status">{{ model.notice }}</p>
    <details v-if="model.replies.length"><summary>Bot delivery needs attention ({{ model.replies.length }})</summary><div v-for="reply in model.replies" :key="reply.id" class="cf-twitch-reply"><strong>{{ reply.status === 'uncertain' ? 'Delivery unconfirmed' : 'Not sent' }}</strong><p>{{ reply.error }}</p><button v-if="reply.status === 'failed'" type="button" class="cf-btn cf-btn-secondary" :disabled="model.checking" @click="model.retry(reply.id)">Retry reply</button></div></details>
  </section>
</template>
