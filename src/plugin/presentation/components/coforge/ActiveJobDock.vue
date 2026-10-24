<script setup lang="ts">
import { useStudioShell } from '../../composables/coforge/use-studio-app';
import CfIcon from './CfIcon.vue';

const model = useStudioShell();
</script>
<template>
  <div class="cf-active-job-dock" role="status">
    <span class="cf-agent-dock-icon"><CfIcon name="bot" /></span>
    <div>
      <strong>{{ model.dockTitle }}</strong>
      <button type="button" @click="model.store.select(model.store.activeJob?.ideaId ?? null)">
        {{ model.store.activeJob?.ideaId }}
        <span>{{ model.activeIdea?.title }}</span>
        <CfIcon name="arrow-up-right" size="xs" />
      </button>
    </div>
    <CfIcon name="loader-circle" size="sm" class="cf-spin" />
  </div>
</template>
