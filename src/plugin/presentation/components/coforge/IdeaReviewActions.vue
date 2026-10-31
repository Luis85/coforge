<script setup lang="ts">
import type { Idea } from "../../../features/coforge/domain/types";
import { useIdeaDrawerContext } from "../../composables/coforge/use-idea-drawer";
import CfIcon from "./CfIcon.vue";

defineProps<{ idea: Idea }>();
const drawer = useIdeaDrawerContext();
</script>
<template>
  <footer class="cf-idea-footer">
    <template v-if="drawer.reviewable && drawer.canFinalReview">
      <label class="cf-field cf-idea-field">
        <span
          >Review note
          <span class="cf-muted">· required for changes</span></span
        >
        <textarea
          v-model="drawer.note"
          rows="2"
          maxlength="2000"
          placeholder="What worked? What should change?"
        />
      </label>
      <div class="cf-idea-review-actions">
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="drawer.isBusy"
          @click="drawer.act('reject')"
        >
          Archive
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="drawer.isBusy"
          @click="drawer.act('changes')"
        >
          Request changes
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="drawer.isBusy || !drawer.canAccept"
          @click="drawer.act('approve')"
        >
          <CfIcon name="check" /> Accept increment
        </button>
      </div>
    </template>
    <div
      v-else-if="idea.status === 'building'"
      class="cf-idea-inline"
      role="status"
    >
      <CfIcon name="loader-circle" size="lg" class="cf-spin" />
      <span>The agent is preparing an increment for your review.</span>
    </div>
    <template v-else-if="drawer.nextAction && !drawer.operatorHeld">
      <p class="cf-idea-help">{{ drawer.nextHelp }}</p>
      <button
        type="button"
        class="cf-btn cf-btn-primary cf-idea-full-button"
        :disabled="drawer.isBusy || drawer.blockedBuild"
        @click="drawer.runConfigured()"
      >
        <CfIcon v-if="drawer.isBusy" name="loader-circle" class="cf-spin" />
        <CfIcon v-else name="play" />
        {{ drawer.nextLabel }}
        <span v-if="drawer.isDemo" class="cf-idea-button-mode">Demo</span>
      </button>
    </template>
  </footer>
</template>
