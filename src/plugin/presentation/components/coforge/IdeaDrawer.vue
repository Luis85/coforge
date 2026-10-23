<script setup lang="ts">
import { useIdeaDrawer } from '../../composables/coforge/use-idea-drawer';
import CfIcon from './CfIcon.vue';
import IdeaActivityTab from './IdeaActivityTab.vue';
import IdeaDrawerHeader from './IdeaDrawerHeader.vue';
import IdeaIncrementTab from './IdeaIncrementTab.vue';
import IdeaOverviewTab from './IdeaOverviewTab.vue';
import IdeaPlanTab from './IdeaPlanTab.vue';
import IdeaReviewActions from './IdeaReviewActions.vue';

const model = useIdeaDrawer();
</script>
<template>
  <div class="cf-overlay cf-idea-overlay" @mousedown="model.focus.backdrop">
    <aside
      :ref="model.focus.bind" class="cf-drawer cf-idea-drawer" role="dialog" aria-modal="true"
      aria-labelledby="cf-idea-drawer-title" @keydown="model.focus.keydown"
    >
      <template v-if="model.idea">
        <IdeaDrawerHeader :idea="model.idea" />
        <div class="cf-idea-scroll">
          <div v-if="model.error" class="cf-idea-alert is-error" role="alert">
            <CfIcon name="circle-alert" />
            <span>{{ model.error }}</span>
          </div>
          <div v-if="model.activeJob" class="cf-idea-alert is-agent">
            <CfIcon name="loader-circle" size="lg" class="cf-spin" />
            <span>
              <strong>{{ model.activeJobTitle }}</strong>
              <small>{{ model.activeJobLog }}</small>
            </span>
            <button
              type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" :disabled="model.store.busy || Boolean(model.pending)"
              @click="model.cancelJob(model.activeJob.id)"
            >
              <CfIcon name="circle-stop" size="sm" /> Cancel run
            </button>
          </div>
          <div v-if="model.idea.lastError" class="cf-idea-alert is-error">
            <CfIcon name="circle-alert" />
            <span>
              <strong>Last run needs attention</strong>
              <small>{{ model.idea.lastError }}</small>
            </span>
          </div>
          <IdeaOverviewTab v-if="model.tab === 'overview'" :idea="model.idea" />
          <IdeaPlanTab v-else-if="model.tab === 'plan'" :idea="model.idea" />
          <IdeaIncrementTab v-else-if="model.tab === 'increment'" :idea="model.idea" />
          <IdeaActivityTab v-else />
        </div>
        <IdeaReviewActions v-if="model.showFooter" :idea="model.idea" />
      </template>
    </aside>
  </div>
</template>
