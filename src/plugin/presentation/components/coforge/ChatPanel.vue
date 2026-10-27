<script setup lang="ts">
import { useChatPanel } from '../../composables/coforge/use-chat-panel';
import CfIcon from './CfIcon.vue';
import ChatComposer from './ChatComposer.vue';
import ChatMessageItem from './ChatMessageItem.vue';

defineProps<{ full?: boolean }>();
const model = useChatPanel();
</script>
<template>
  <aside class="cf-chat-panel" :class="{ 'is-full': full }" aria-label="Stream chat">
    <header class="cf-chat-header">
      <div>
        <CfIcon name="message-square" />
        <h2>Stream chat</h2>
      </div>
      <span class="cf-connection-pill" :class="{ 'is-live': model.live }" :title="model.chatStatus || undefined">
        <span />
        {{ model.sourceLabel }}
        <span v-if="model.chatStatus" class="cf-sr-only">: {{ model.chatStatus }}</span>
      </span>
    </header>
    <div class="cf-chat-channel">
      <CfIcon name="hash" size="xs" />
      <span class="cf-chat-channel-name">{{ model.channel }}</span>
      <span class="cf-chat-people" :aria-label="`${model.people} contributors`">
        <CfIcon name="users" size="xs" />
        {{ model.people }} contributors
      </span>
    </div>
    <div class="cf-chat-pinned">
      <CfIcon name="sparkles" size="sm" />
      <div>
        <strong>Viewer commands</strong>
        <p><code>!register</code> joins The Hood.<br><code>!projects</code> lists project IDs.<br><code>!request</code> or <code>!bug</code> submits to a project.</p>
      </div>
      <button
        type="button" class="cf-icon-button" aria-label="Show chat command help" :aria-expanded="model.showHelp"
        @click="model.toggleHelp()"
      >
        <CfIcon name="chevron-down" size="sm" />
      </button>
    </div>
    <div v-if="model.showHelp" class="cf-chat-help">
      <strong>Chat commands</strong>
      <p><code>!register</code> before requests, bugs and votes. Features have a 5-minute cooldown.</p>
      <p><code>{{ model.requestExample }}</code></p>
      <p><code>!bug &lt;project-id&gt; Describe the bug</code></p>
      <p><code>!vote CF-101</code></p>
      <p><code>!context CF-101 Extra details</code> appends context and returns an open request to screening.</p>
      <p><code>!help</code> explains the system; add <code>requests</code>, <code>progress</code> or <code>community</code> for more.</p>
      <p><code>!status CF-101</code> · <code>!me</code></p>
      <p>
        Project IDs are required for requests and bugs. Twitch uses each viewer’s account ID; duplicate events are ignored.
      </p>
    </div>
    <div
      :ref="model.bindList" class="cf-chat-messages" role="log" tabindex="0" aria-label="Chat messages" aria-live="polite"
      aria-relevant="additions" @scroll.passive="model.onScroll()"
    >
      <div class="cf-chat-session-start">
        <span />
        {{ model.sessionLabel }}
        <span />
      </div>
      <ChatMessageItem v-for="message in model.messages" :key="message.id" :message="message" :can-moderate="Boolean(model.store.state?.runtime.twitch?.canModerate && message.externalId && message.channelId === model.store.state?.runtime.twitch?.channel?.id)" @select="model.select($event)" @moderate="model.moderate($event)" />
      <div v-if="model.empty" class="cf-empty-state">
        <CfIcon name="message-square" size="lg" />
        <p>Be the first to start a conversation.</p>
      </div>
    </div>
    <ChatComposer @sent="model.stick()" />
  </aside>
</template>
