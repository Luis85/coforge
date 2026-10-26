<script setup lang="ts">
import { useStreamPage } from '../../composables/coforge/use-stream-page';
import CfIcon from './CfIcon.vue';
import ChatPanel from './ChatPanel.vue';

const model = useStreamPage();
</script>
<template>
  <div class="cf-stream-page">
    <div class="cf-page-heading">
      <div>
        <h1>The conversation<span class="cf-heading-dot">.</span></h1>
        <p>Ideas, votes, and the people moving your game forward.</p>
      </div>
      <span class="cf-badge">{{ model.intakeLabel }}</span>
    </div>
    <div class="cf-stream-layout">
      <ChatPanel full />
      <section class="cf-stream-reference" aria-labelledby="cf-stream-reference-title">
        <h2 id="cf-stream-reference-title">Give chat a part in the story.</h2>
        <p>Every contribution has an identity, a history, and a place in the build.</p>
        <div class="cf-command-reference">
          <code>!request &lt;project-id&gt; Add a day / night cycle</code>
          <span>Pitch a feature. Receive an idea ID.</span>
          <code>!vote CF-101</code>
          <span>Support an idea. One vote per viewer.</span>
          <code>!status CF-101</code>
          <span>Follow an idea through implementation.</span>
          <code>!me</code>
          <span>Check your contribution record.</span>
        </div>
        <div class="cf-stream-note">
          <CfIcon name="shield-check" size="lg" />
          <p>
            Bot acknowledgments appear in this local studio. CoForge receives Twitch chat; it does not post replies
            to Twitch.
          </p>
        </div>
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.store.navigate('community')">
          <CfIcon name="trophy" /> Explore community recognition
        </button>
      </section>
    </div>
  </div>
</template>
