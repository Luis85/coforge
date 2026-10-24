<script setup lang="ts">
import type { CommunityModel } from '../../composables/coforge/use-community';
import CfIcon from './CfIcon.vue';

defineProps<{ model: CommunityModel }>();
</script>
<template>
  <section v-if="model.selected" class="cf-community-profile">
    <div class="cf-community-profile-person">
      <span class="cf-avatar cf-community-avatar-lg" :style="model.selected.style">{{ model.selected.initials }}</span>
      <div>
        <h2>{{ model.selected.name }}</h2>
        <p>{{ model.selected.earnedText }}</p>
      </div>
    </div>
    <div class="cf-community-profile-stats">
      <div><strong>{{ model.selected.ideas }}</strong><span>Ideas</span></div>
      <div><strong>{{ model.selected.votesCast }}</strong><span>Votes cast</span></div>
      <div><strong>{{ model.selected.implementations }}</strong><span>Accepted</span></div>
    </div>
    <h3>Their contributions</h3>
    <div v-if="model.selected.ideasList.length" class="cf-community-profile-ideas">
      <button v-for="idea in model.selected.ideasList" :key="idea.id" type="button" @click="model.openIdea(idea.id)">
        <span class="cf-community-inline">
          <span class="cf-mono cf-community-id">{{ idea.id }}</span>
          <span class="cf-badge" :class="`cf-status-${idea.status}`">{{ idea.statusLabel }}</span>
        </span>
        <strong>{{ idea.title }}</strong>
        <span class="cf-community-profile-idea-footer">
          <span><CfIcon name="arrow-up" size="xs" />{{ idea.votes }}</span>
          <CfIcon name="chevron-right" size="sm" />
        </span>
      </button>
    </div>
    <p v-else class="cf-community-help">This member is helping other creators by voting for their ideas.</p>
  </section>
</template>
