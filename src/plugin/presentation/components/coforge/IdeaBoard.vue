<script setup lang="ts">
import { useIdeaBoard } from '../../composables/coforge/use-board';
import BoardKanban from './BoardKanban.vue';
import BoardTable from './BoardTable.vue';
import BoardToolbar from './BoardToolbar.vue';
import BoardWelcome from './BoardWelcome.vue';
import CfIcon from './CfIcon.vue';

const model = useIdeaBoard();
</script>
<template>
  <section class="cf-board-page">
    <div class="cf-page-heading">
      <div>
        <h1>Community board<span class="cf-heading-dot">.</span></h1>
        <p>Good ideas start in chat. Great games get built together.</p>
      </div>
      <button type="button" class="cf-btn cf-btn-primary" @click="model.startNew()">
        <CfIcon name="plus" /> New idea
      </button>
    </div>
    <BoardWelcome v-if="model.projectEmpty" />
    <template v-else>
      <BoardToolbar />
      <div v-if="!model.filtered.length" class="cf-board-empty">
        <CfIcon name="circle-dashed" />
        <h2>{{ model.emptyTitle }}</h2>
        <p>{{ model.emptyText }}</p>
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.resolveEmpty()">{{ model.emptyAction }}</button>
      </div>
      <BoardTable v-else-if="model.layout === 'list'" />
      <BoardKanban v-else />
    </template>
    <div class="cf-board-footnote">
      <span><CfIcon name="shield-alert" size="sm" /> Every increment comes back to you for review.</span>
      <span><CfIcon name="sparkles" size="xs" /> Score = reach × impact × confidence ÷ effort</span>
    </div>
  </section>
</template>
