<script setup lang="ts">
import { useStreamPage } from "../../composables/coforge/use-stream-page";
import ChatPanel from "./ChatPanel.vue";
import TwitchChannelControls from "./TwitchChannelControls.vue";
import StreamMessagesView from "./StreamMessagesView.vue";
import TwitchModeration from "./TwitchModeration.vue";
import CfSubpageNav from "./CfSubpageNav.vue";
import { STREAM_PAGES } from "../../stores/studio-pages";
const model = useStreamPage();
</script>
<template>
  <div class="cf-stream-page">
    <header class="cf-page-heading">
      <div>
        <h1>Stream chat</h1>
        <p>
          Follow the conversation, help viewers participate and moderate with an
          explicit target.
        </p>
      </div>
      <span class="cf-badge">{{ model.intakeLabel }}</span>
    </header>
    <CfSubpageNav
      label="Stream tools"
      :items="STREAM_PAGES"
      :selected="model.tab"
      @select="model.tab = $event"
    />
    <div
      v-show="model.tab === 'channel'"
      class="cf-stream-layout"
      role="region"
      aria-label="Stream conversation"
    >
      <ChatPanel full />
      <div class="cf-stream-reference">
        <TwitchModeration />
        <details class="cf-command-reference">
          <summary>Viewer commands</summary>
          <code>!help</code
          ><span
            >Learn how the community works. Topics: requests, progress and
            community.</span
          >
          <code>!projects</code><span>List project IDs.</span>
          <code>!register</code
          ><span>Register before requesting, reporting bugs or voting.</span>
          <code>!ranks</code
          ><span>See named ranks and their XP thresholds.</span>
          <code>!request &lt;project-id&gt; Describe the feature</code
          ><span>Create a feature request.</span>
          <code>!bug &lt;project-id&gt; Describe the bug</code
          ><span>Report a bug.</span> <code>!context CF-101 Extra details</code
          ><span>Add context and return an open request to screening.</span>
          <code>!vote CF-101</code><span>One vote per viewer and request.</span>
          <code>!status CF-101</code><span>Check a request.</span
          ><code>!me</code><span>Check your contributions.</span>
        </details>
      </div>
    </div>
    <div
      v-show="model.tab === 'connection'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Twitch configuration"
    >
      <TwitchChannelControls />
    </div>
    <div
      v-show="model.tab === 'messages'"
      class="cf-subpage-panel"
      role="region"
      aria-label="Recurring chatbot messages"
    >
      <StreamMessagesView />
    </div>
  </div>
</template>
