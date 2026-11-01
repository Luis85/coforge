<script setup lang="ts">
import { useIdeaDrawer } from '../../composables/coforge/use-idea-drawer';
import CfIcon from './CfIcon.vue';
import IdeaActivityTab from './IdeaActivityTab.vue';
import IdeaDrawerHeader from './IdeaDrawerHeader.vue';
import IdeaIncrementTab from './IdeaIncrementTab.vue';
import IdeaOverviewTab from './IdeaOverviewTab.vue';
import IdeaPlanTab from './IdeaPlanTab.vue';
import IdeaReviewActions from './IdeaReviewActions.vue';
import IdeaWorkflowTab from './IdeaWorkflowTab.vue';
import IdeaSessionsTab from './IdeaSessionsTab.vue';

const model = useIdeaDrawer();
</script>
<template>
  <div class="cf-overlay cf-idea-overlay" @mousedown="model.focus.backdrop">
    <div
      :ref="model.focus.bind" class="cf-drawer cf-idea-drawer" :class="{ 'is-sessions': model.tab === 'sessions' }" role="dialog" aria-modal="true"
      aria-labelledby="cf-idea-drawer-title" @keydown="model.focus.keydown"
    >
      <template v-if="model.idea">
        <IdeaDrawerHeader :idea="model.idea" />
        <div class="cf-idea-scroll">
          <template v-if="model.tab !== 'sessions'">
          <div v-if="model.operatorHeld" class="cf-idea-alert" role="status">
            <CfIcon name="circle-stop" />
            <span class="cf-notice-body"><strong>{{ model.preservedReview ? 'Stopped — preserved changes need review' : 'This workflow is stopped' }}</strong><small>{{ model.preservedReview ? 'Open Increment to inspect the preserved changes, then accept them or request changes. After requesting changes, right-click the card and choose Restart workflow.' : 'Right-click this card and choose Restart workflow' }}</small><small v-if="model.backgroundRetryAvailable">Workflow runs also offers a reviewed background Build retry that keeps earlier steps. Releasing this Stop hold requires your explicit confirmation.</small></span>
          </div>
          <div v-if="model.error" class="cf-idea-alert is-error" role="alert">
            <CfIcon name="circle-alert" />
            <span class="cf-notice-body">{{ model.error }}</span>
          </div>
          <div v-if="model.activeJob" class="cf-idea-alert is-agent">
            <CfIcon name="loader-circle" size="lg" class="cf-spin" />
            <span class="cf-notice-body">
              <strong role="status">{{ model.activeJobTitle }}</strong>
              <small tabindex="0" role="region" aria-label="Current run log">{{ model.activeJobLog }}</small>
            </span>
            <button
              type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" :disabled="model.store.busy || Boolean(model.pending)"
              @click="model.cancelJob(model.activeJob.id)"
            >
              <CfIcon name="circle-stop" size="sm" /> Cancel run
            </button>
          </div>
          <div v-if="model.idea.lastError" class="cf-idea-alert is-error" role="alert">
            <CfIcon name="circle-alert" />
            <span class="cf-notice-body">
              <strong>Request needs attention</strong>
              <small>{{ model.idea.lastError }}</small>
            </span>
          </div>
          </template>
          <IdeaOverviewTab v-if="model.tab === 'overview'" :idea="model.idea" />
          <IdeaSessionsTab v-else-if="model.tab === 'sessions'" :key="model.idea.id" :idea="model.idea" />
          <IdeaPlanTab v-else-if="model.tab === 'plan'" :idea="model.idea" />
          <IdeaIncrementTab v-else-if="model.tab === 'increment'" :idea="model.idea" />
          <IdeaWorkflowTab v-else-if="model.tab === 'workflow'" :key="model.idea.id" :idea="model.idea" />
          <IdeaActivityTab v-else />
        </div>
        <IdeaReviewActions v-if="model.showFooter && model.tab !== 'workflow' && model.tab !== 'sessions'" :idea="model.idea" />
      </template>
    </div>
  </div>
</template>
