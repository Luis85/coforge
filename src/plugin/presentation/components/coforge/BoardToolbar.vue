<script setup lang="ts">
import { useBoardView } from '../../composables/coforge/use-board';
import CfIcon from './CfIcon.vue';

const model = useBoardView();
</script>
<template>
  <div class="cf-board-tabs" role="tablist" aria-label="Filter ideas">
    <button
      v-for="tab in model.tabs" :key="tab.key" type="button" role="tab" :aria-selected="tab.selected"
      :class="{ 'is-active': tab.selected }" @click="model.setFilter(tab.key)"
    >
      <CfIcon v-if="tab.key === 'flagged'" name="flag" size="sm" /> {{ tab.label }}
      <span class="cf-board-tab-count" :class="{ 'is-review': tab.highlight }">{{ tab.count }}</span>
    </button>
  </div>
  <div class="cf-board-toolbar">
    <div class="cf-board-search">
      <CfIcon name="search" size="sm" />
      <input v-model="model.query" type="text" aria-label="Search ideas" placeholder="Search ideas, people, or IDs…">
      <button v-if="model.query" type="button" class="cf-icon-button" aria-label="Clear search" @click="model.clearQuery()">
        <CfIcon name="x" size="xs" />
      </button>
    </div>
    <div class="cf-board-filters">
      <label class="cf-compact-select"><span class="cf-sr-only">Request type</span><select v-model="model.requestKind"><option value="all">Features and bugs</option><option value="feature">Features</option><option value="bug">Bugs</option></select><CfIcon name="chevron-down" size="xs" /></label>
      <label class="cf-compact-select cf-category-filter">
        <span class="cf-sr-only">Filter category</span>
        <select v-model="model.category">
          <option value="">All categories</option>
          <option v-for="item in model.categories" :key="item" :value="item">{{ item }}</option>
        </select>
        <CfIcon name="chevron-down" size="xs" />
      </label>
      <label class="cf-compact-select">
        <span class="cf-sr-only">Sort ideas</span>
        <select v-model="model.sort">
          <option v-for="option in model.sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <CfIcon name="chevron-down" size="xs" />
      </label>
      <div class="cf-segmented">
        <button
          type="button" :class="{ 'is-active': model.layout === 'board' }" aria-label="Board view"
          :aria-pressed="model.layout === 'board'" @click="model.setLayout('board')"
        >
          <CfIcon name="layout-grid" size="sm" />
        </button>
        <button
          type="button" :class="{ 'is-active': model.layout === 'list' }" aria-label="List view"
          :aria-pressed="model.layout === 'list'" @click="model.setLayout('list')"
        >
          <CfIcon name="list" size="sm" />
        </button>
      </div>
    </div>
  </div>
</template>
