<script setup lang="ts">
import type { CommunityModel } from '../../composables/coforge/use-community';
import CfIcon from './CfIcon.vue';

defineProps<{ model: CommunityModel }>();
</script>
<template>
  <section v-if="model.selected" class="cf-community-badge-collection">
    <div class="cf-community-section-heading">
      <div>
        <h2><CfIcon name="award" /> {{ model.selected.name }}’s badge collection</h2>
        <p class="cf-community-help">{{ model.selected.collectionText }}</p>
      </div>
    </div>
    <div class="cf-community-badge-list">
      <div v-for="badge in model.selected.badges" :key="badge.id" class="cf-community-badge-row" :class="{ 'is-earned': badge.earned }">
        <span class="cf-community-badge-symbol"><CfIcon :name="badge.icon" size="lg" /></span>
        <div class="cf-community-badge-description">
          <div>
            <strong>{{ badge.title }}</strong>
            <span v-if="badge.earned" class="cf-community-badge-earned"><CfIcon name="check" size="xs" /> Earned</span>
            <span v-else class="cf-community-badge-progress-text">{{ badge.progressText }}</span>
          </div>
          <p>{{ badge.description }}</p>
          <progress v-if="!badge.earned" :value="badge.current" :max="badge.threshold" :aria-label="badge.progressLabel" />
        </div>
      </div>
    </div>
    <p class="cf-community-help">
      Badges update from recorded activity. Flagged and archived ideas are excluded; a viewer’s self-votes do not count toward the Backer
      badge.
    </p>
  </section>
</template>
