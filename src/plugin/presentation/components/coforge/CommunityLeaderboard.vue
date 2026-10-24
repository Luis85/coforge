<script setup lang="ts">
import type { CommunityModel } from '../../composables/coforge/use-community';
import CfIcon from './CfIcon.vue';

defineProps<{ model: CommunityModel }>();
</script>
<template>
  <section class="cf-community-leaderboard">
    <div class="cf-community-section-heading">
      <h2><CfIcon name="trophy" /> Community leaderboard</h2>
      <span class="cf-community-help">All time</span>
    </div>
    <nav class="cf-community-metric-tabs" aria-label="Leaderboard ranking">
      <button
        v-for="option in model.metrics" :key="option.id" type="button" :class="{ 'is-active': option.active }"
        :aria-pressed="option.active" @click="model.setMetric(option.id)"
      >
        <CfIcon :name="option.icon" size="sm" />
        {{ option.label }}
      </button>
    </nav>
    <div v-if="model.leaders.length" class="cf-community-leader-table">
      <div class="cf-community-leader-head">
        <span>Rank</span>
        <span>Community member</span>
        <span>{{ model.unit }}</span>
      </div>
      <button
        v-for="row in model.leaders" :key="row.id" type="button" class="cf-community-leader-row"
        :class="{ 'is-leading': row.leading, 'is-selected': row.selected }" :aria-pressed="row.selected" @click="model.selectContributor(row.id)"
      >
        <span class="cf-community-rank" :class="row.rankClass">
          <CfIcon v-if="row.leading" name="crown" />
          <template v-else>{{ row.rank }}</template>
        </span>
        <span class="cf-community-member">
          <span class="cf-avatar" :style="row.style">{{ row.initials }}</span>
          <span class="cf-community-member-info">
            <strong>{{ row.name }}</strong>
            <span>
              {{ row.ideasText }}<span class="cf-community-dot-separator">·</span>{{ row.acceptedText }}
            </span>
          </span>
          <span class="cf-community-member-badges">
            <span v-for="badge in row.badges" :key="badge.id" :title="badge.hint"><CfIcon :name="badge.icon" size="sm" /></span>
          </span>
        </span>
        <strong class="cf-community-leader-score">
          {{ row.score }}
          <CfIcon v-if="row.showVoteIcon" name="arrow-up" size="sm" />
        </strong>
      </button>
    </div>
    <div v-else class="cf-community-empty">
      <CfIcon name="users" />
      <h3>A community starts with one idea</h3>
      <p>Submit a request in chat. Contributors appear here after their ideas pass screening or they support eligible ideas.</p>
    </div>
    <button v-if="model.hasMore" type="button" class="cf-btn cf-btn-ghost cf-community-more" @click="model.toggleShowAll()">
      {{ model.moreLabel }}
    </button>
    <p class="cf-community-leaderboard-note">
      <CfIcon name="flag" size="sm" />
      Only screened, eligible ideas count. Votes received are unique votes on a member’s ideas. Implementation credit follows your
      acceptance of an increment.
    </p>
  </section>
</template>
