<script setup lang="ts">
import { useBoardView } from '../../composables/coforge/use-board';
import CfIcon from './CfIcon.vue';
const model = useBoardView();
</script>
<template>
  <section v-if="model.summary" class="cf-board-decisions" aria-label="Project request decisions">
    <div class="cf-board-decision-intro"><h2>Move the next idea forward</h2><p>Current project · {{ model.summary.requests }} requests, including {{ model.summary.accepted }} accepted.</p></div>
    <div class="cf-board-decision-actions">
      <button type="button" :class="{ 'has-work': model.summary.review > 0 }" @click="model.showDecision('review')"><CfIcon name="clipboard-check" /><strong>{{ model.summary.review }}</strong><span>Ready for review</span><CfIcon name="arrow-right" size="sm" /></button>
      <button type="button" :class="{ 'has-work': model.summary.flagged > 0 }" @click="model.showDecision('flagged')"><CfIcon name="shield-alert" /><strong>{{ model.summary.flagged }}</strong><span>Need moderation</span><CfIcon name="arrow-right" size="sm" /></button>
      <div><CfIcon name="inbox" /><strong>{{ model.summary.inbox }}</strong><span>Awaiting screening</span></div>
    </div>
  </section>
</template>
