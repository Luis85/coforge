<script setup lang="ts">
import { useStreamPage } from '../../composables/coforge/use-stream-page';
import ChatPanel from './ChatPanel.vue';
import TwitchChannelControls from './TwitchChannelControls.vue';
const model = useStreamPage();
</script>
<template>
  <div class="cf-stream-page">
    <header class="cf-page-heading"><h1>Channel</h1><span class="cf-badge">{{ model.intakeLabel }}</span></header>
    <div class="cf-stream-layout">
      <ChatPanel full />
      <div class="cf-stream-reference"><TwitchChannelControls />
        <details class="cf-command-reference"><summary>Viewer commands</summary>
          <code>!projects</code><span>List project IDs.</span>
          <code>!request &lt;project-id&gt; Describe the feature</code><span>Create a feature request.</span>
          <code>!bug &lt;project-id&gt; Describe the bug</code><span>Report a bug.</span>
          <code>!vote CF-101</code><span>One vote per viewer and request.</span>
          <code>!status CF-101</code><span>Check a request.</span><code>!me</code><span>Check your contributions.</span>
        </details>
      </div>
    </div>
  </div>
</template>
