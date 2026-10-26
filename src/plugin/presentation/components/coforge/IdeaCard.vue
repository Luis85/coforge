<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIdeaCard } from '../../composables/coforge/use-board-card';
import CfIcon from './CfIcon.vue';

const props = defineProps<{ idea: Idea }>();
const model = useIdeaCard(props);
</script>
<template>
  <article class="cf-idea-card" :class="{ 'is-flagged': model.flagged, 'is-review': model.review }">
    <button type="button" class="cf-idea-open" :title="model.openLabel" @click="model.open()">
      <div class="cf-idea-card-top">
        <span class="cf-idea-id">{{ model.idea.id }}</span>
        <span class="cf-category-dot" :class="model.categoryClass" :title="model.idea.category" />
        <span class="cf-idea-category">{{ model.idea.category }}</span>
      </div>
      <h3>{{ model.idea.title }}</h3>
      <p class="cf-idea-description">{{ model.idea.description }}</p>
      <span v-if="model.state" class="cf-card-state" :class="`cf-state-${model.state.tone}`">
        <CfIcon :name="model.state.icon" size="xs" :class="{ 'cf-spin': model.state.spin }" />
        {{ model.state.label }}
      </span>
    </button>
    <div class="cf-idea-card-footer">
      <div class="cf-idea-author" :title="model.authorName">
        <span class="cf-avatar cf-avatar-sm" :style="model.avatar">{{ model.authorInitials }}</span>
        <span>{{ model.authorName }}</span>
      </div>
      <div class="cf-idea-card-numbers">
        <span v-if="model.rice !== null" class="cf-rice-mini" :title="model.riceTitle">
          <CfIcon name="sparkles" size="xs" />{{ model.rice }}
        </span>
        <button
          type="button" class="cf-vote-button" :class="{ 'is-voted': model.voted }" :disabled="model.voteDisabled"
          :aria-label="model.voteLabel" :title="model.voteTitle" @click="model.vote()"
        >
          <CfIcon name="arrow-up" size="sm" />
          <span>{{ model.idea.voters.length }}</span>
        </button>
      </div>
    </div>
  </article>
</template>
