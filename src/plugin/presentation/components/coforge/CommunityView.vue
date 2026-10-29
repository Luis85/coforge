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
      <section class="cf-decision-brief" aria-label="Community contribution overview">
        <div>
          <h2>See who is shaping the game</h2>
          <p>Rank by support, screened ideas or accepted work. Select a contributor to inspect the evidence behind their recognition.</p>
          <div class="cf-community-overview-people">
            <span class="cf-community-avatar-stack" aria-hidden="true">
              <span v-for="member in model.stack" :key="member.id" class="cf-avatar cf-avatar-sm" :style="member.style">{{ member.initials }}</span>
            </span>
            <span class="cf-community-mode-label">{{ model.modeLabel }} · screened contributions</span>
          </div>
        </div>
        <dl>
          <div><dt>Makers</dt><dd>{{ model.makers }}</dd></div>
          <div><dt>Votes received</dt><dd>{{ model.totalVotes }}</dd></div>
          <div><dt>Accepted increments</dt><dd>{{ model.acceptedCount }}</dd></div>
        </dl>
      </section>
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
