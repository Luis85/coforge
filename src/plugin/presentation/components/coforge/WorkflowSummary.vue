<script setup lang="ts">
import CfIcon from './CfIcon.vue';
defineProps<{
  paused: boolean;
  summaryLabel: string;
  automaticStepLabel: string;
  cadenceLabel: string;
  providerTitle: string;
  providerIcon: string;
  providerLabel: string;
}>();
</script>
<template>
  <div class="cf-workflow-summary">
    <span class="cf-workflow-live-dot" :class="{ 'is-paused': paused }" />
    <strong>{{ summaryLabel }}</strong>
    <span>{{ automaticStepLabel }}</span>
    <span>{{ cadenceLabel }}</span>
    <span class="cf-workflow-mode-tag" :title="providerTitle">
      <CfIcon :name="providerIcon" size="sm" />{{ providerLabel }}
    </span>
  </div>
</template>
