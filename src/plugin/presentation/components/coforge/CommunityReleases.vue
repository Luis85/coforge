<script setup lang="ts">
import type { CommunityModel } from '../../composables/coforge/use-community';
import CfIcon from './CfIcon.vue';

defineProps<{ model: CommunityModel }>();
</script>
<template>
  <section class="cf-community-releases">
    <h2><CfIcon name="check-check" /> From chat to game</h2>
    <p class="cf-community-help">Accepted ideas, credited to their creators.</p>
    <div v-if="model.accepted.length" class="cf-community-accepted-list">
      <button v-for="idea in model.accepted" :key="idea.id" type="button" class="cf-community-accepted-idea" @click="model.openIdea(idea.id)">
        <span class="cf-community-inline">
          <span class="cf-mono cf-community-id">{{ idea.id }}</span>
          <span class="cf-community-accepted-check"><CfIcon name="check-check" size="sm" /> Accepted</span>
        </span>
        <strong>{{ idea.title }}</strong>
        <span class="cf-community-accepted-credit">
          <span class="cf-avatar cf-community-avatar-xs" :style="idea.authorStyle">{{ idea.authorInitials }}</span>
          <span>{{ idea.author }}</span>
          <CfIcon name="chevron-right" />
        </span>
      </button>
    </div>
    <div v-else class="cf-community-quiet-state">
      <CfIcon name="lightbulb" size="lg" />
      <p>Your first accepted idea will appear here, with credit to its creator.</p>
    </div>
  </section>
  <section class="cf-community-invite">
    <CfIcon name="heart-handshake" size="lg" />
    <h3>Make room for the next idea.</h3>
    <p>Share the commands on stream and let your community help shape the game.</p>
    <div class="cf-community-invite-command">
      <code>!request your idea</code>
      <CfIcon name="arrow-right" size="sm" />
    </div>
    <div class="cf-community-invite-command">
      <code>!vote CF-101</code>
      <CfIcon name="arrow-up" size="sm" />
    </div>
    <div class="cf-community-invite-command">
      <code>!status CF-101</code>
      <CfIcon name="message-square" size="sm" />
    </div>
  </section>
</template>
