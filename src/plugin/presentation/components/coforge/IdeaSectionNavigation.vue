<script setup lang="ts">
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
const model = useIdeaDrawerContext();
</script>
<template>
  <nav class="cf-idea-tabs" aria-label="Idea sections">
    <div v-for="item in model.tabs" :key="item.value" class="cf-idea-nav-item">
      <button
        type="button" :class="{ 'is-active': item.active }" :aria-label="item.label"
        :aria-describedby="`cf-idea-hint-${item.value}`" :aria-pressed="item.active" aria-controls="cf-idea-section-content" @click="model.selectTab(item.value)"
      >
        <span class="cf-idea-tab-label">{{ item.label }}<span v-if="item.dot" class="cf-idea-tab-dot" aria-hidden="true" /></span>
      </button>
      <small :id="`cf-idea-hint-${item.value}`">{{ item.hint }}<span v-if="item.dot"> · Saved</span></small>
    </div>
  </nav>
</template>
