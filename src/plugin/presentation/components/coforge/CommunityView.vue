<script setup lang="ts">
import { useCommunity } from '../../composables/coforge/use-community';
import CommunityBadges from './CommunityBadges.vue';
import CommunityLeaderboard from './CommunityLeaderboard.vue';
import CommunityProfile from './CommunityProfile.vue';
import CommunityReleases from './CommunityReleases.vue';

const model = useCommunity();
</script>
<template>
  <div class="cf-community-page">
    <header class="cf-page-heading cf-community-heading">
      <div>
        <h1>Community recognition</h1>
        <p>Review contributors, earned badges and accepted work across projects.</p>
      </div>
    </header>
    <div class="cf-community-summary">
      <span class="cf-community-avatar-stack">
        <span v-for="member in model.stack" :key="member.id" class="cf-avatar cf-avatar-sm" :style="member.style">{{ member.initials }}</span>
      </span>
      <p>
        <strong>{{ model.makers }} makers</strong> have contributed screened ideas, with
        <strong>{{ model.totalVotes }} votes</strong> and <strong>{{ model.acceptedCount }} accepted increments</strong>.
      </p>
      <span class="cf-community-mode-label">{{ model.modeLabel }}</span>
    </div>
    <div class="cf-community-layout">
      <div class="cf-community-main">
        <CommunityLeaderboard :model="model" />
        <CommunityBadges v-if="model.selected" :model="model" />
      </div>
      <aside class="cf-community-aside">
        <CommunityProfile v-if="model.selected" :model="model" />
        <CommunityReleases :model="model" />
      </aside>
    </div>
  </div>
</template>
