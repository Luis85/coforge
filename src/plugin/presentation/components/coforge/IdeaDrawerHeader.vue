<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { STATUS_LABELS } from '../../../features/coforge/domain/types';
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
import CfIcon from './CfIcon.vue';

defineProps<{ idea: Idea }>();
const model = useIdeaDrawerContext();
</script>
<template>
  <header class="cf-idea-top">
    <div class="cf-idea-inline">
      <span class="cf-mono cf-idea-id">{{ idea.id }}</span>
      <CfIcon name="chevron-right" size="sm" />
      <span>Idea details</span>
    </div>
    <div class="cf-idea-inline">
      <button type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" :title="`Open ${idea.id} as a note in the vault`" @click="model.openNote()">
        <CfIcon name="file-text" size="sm" /> Open note
      </button>
      <button type="button" class="cf-icon-button cf-idea-close" aria-label="Close idea details" @click="model.close()">
        <CfIcon name="x" size="lg" />
      </button>
    </div>
  </header>
  <div class="cf-idea-heading">
    <div class="cf-idea-inline cf-idea-wrap">
      <span class="cf-badge" :class="`cf-status-${idea.status}`">{{ STATUS_LABELS[idea.status] }}</span>
      <span class="cf-idea-category">{{ idea.category }}</span>
      <span v-if="idea.projectId" class="cf-badge">Project {{ idea.projectId }}</span>
      <span class="cf-idea-source"><CfIcon name="message-square" size="xs" /> {{ model.sourceLabel }}</span>
    </div>
    <h2 id="cf-idea-drawer-title">{{ idea.title }}</h2>
    <div class="cf-idea-byline">
      <span class="cf-avatar cf-avatar-sm" :style="model.authorStyle">{{ model.authorInitials }}</span>
      <span>Suggested by <strong>{{ model.authorName }}</strong></span>
      <span class="cf-idea-dot-separator" aria-hidden="true">·</span>
      <time :datetime="idea.createdAt">{{ model.createdLabel }}</time>
    </div>
  </div>
  <nav class="cf-idea-tabs" aria-label="Idea sections">
    <button
      v-for="item in model.tabs" :key="item.value" type="button" :class="{ 'is-active': item.active }"
      :aria-pressed="item.active" @click="model.selectTab(item.value)"
    >
      {{ item.label }}
      <span v-if="item.dot" class="cf-idea-tab-dot" />
    </button>
  </nav>
</template>
