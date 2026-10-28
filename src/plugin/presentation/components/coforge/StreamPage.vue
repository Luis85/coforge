<script setup lang="ts">
import { useStreamPage } from '../../composables/coforge/use-stream-page';
import ChatPanel from './ChatPanel.vue';
import TwitchChannelControls from './TwitchChannelControls.vue';
import StreamMessagesView from './StreamMessagesView.vue';
const model = useStreamPage();
</script>
<template>
  <div class="cf-stream-page">
    <header class="cf-page-heading"><div><h1>Stream chat</h1><p>Connect Twitch, talk with viewers and manage your chatbot messages.</p></div><span class="cf-badge">{{ model.intakeLabel }}</span></header>
    <div class="cf-stream-tabs" role="tablist" aria-label="Stream tools"><button id="cf-stream-channel-tab" type="button" role="tab" :tabindex="model.tab === 'channel' ? 0 : -1" @keydown="model.keydown($event)" :aria-selected="model.tab === 'channel'" aria-controls="cf-stream-channel-panel" @click="model.tab = 'channel'">Chat &amp; channel</button><button id="cf-stream-messages-tab" type="button" role="tab" :tabindex="model.tab === 'messages' ? 0 : -1" @keydown="model.keydown($event)" :aria-selected="model.tab === 'messages'" aria-controls="cf-stream-messages-panel" @click="model.tab = 'messages'">Bot messages</button></div>
    <div v-show="model.tab === 'channel'" id="cf-stream-channel-panel" class="cf-stream-layout" role="tabpanel" aria-labelledby="cf-stream-channel-tab">
      <ChatPanel full />
      <div class="cf-stream-reference"><TwitchChannelControls />
        <details class="cf-command-reference"><summary>Viewer commands</summary>
          <code>!help</code><span>Learn how The Hood works. Topics: requests, progress and community.</span>
          <code>!projects</code><span>List project IDs.</span>
          <code>!register</code><span>Join The Hood before requesting, reporting bugs or voting.</span>
          <code>!ranks</code><span>See named ranks and their XP thresholds.</span>
          <code>!request &lt;project-id&gt; Describe the feature</code><span>Create a feature request.</span>
          <code>!bug &lt;project-id&gt; Describe the bug</code><span>Report a bug.</span>
          <code>!context CF-101 Extra details</code><span>Add context and return an open request to screening.</span>
          <code>!vote CF-101</code><span>One vote per viewer and request.</span>
          <code>!status CF-101</code><span>Check a request.</span><code>!me</code><span>Check your contributions.</span>
        </details>
      </div>
    </div>
    <div v-show="model.tab === 'messages'" id="cf-stream-messages-panel" role="tabpanel" aria-labelledby="cf-stream-messages-tab"><StreamMessagesView /></div>
  </div>
</template>
