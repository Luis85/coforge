<script setup lang="ts">
import { useBoardView } from '../../composables/coforge/use-board';
import CfIcon from './CfIcon.vue';
import IdeaCard from './IdeaCard.vue';

const model = useBoardView();
</script>
<template>
  <div class="cf-kanban" :class="{ 'is-filtered': model.filter !== 'all' }">
    <section v-for="column in model.columns" :key="column.title" class="cf-kanban-column" :class="`cf-column-${column.tone}`">
      <header class="cf-column-header">
        <div>
          <CfIcon :name="column.icon" />
          <h2>{{ column.title }}</h2>
          <span class="cf-column-count">{{ column.ideas.length }}</span>
        </div>
        <button v-if="column.canAdd" type="button" class="cf-icon-button" aria-label="Add idea to inbox" @click="model.startNew()">
          <CfIcon name="plus" />
        </button>
      </header>
      <p class="cf-column-hint">{{ column.hint }}</p>
      <div class="cf-column-cards">
        <IdeaCard v-for="idea in column.ideas" :key="idea.id" :idea="idea" />
        <div v-if="!column.ideas.length" class="cf-column-empty">
          <CfIcon :name="column.icon" />
          <span>{{ column.emptyText }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
