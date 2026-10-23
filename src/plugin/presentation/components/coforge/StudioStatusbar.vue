<script setup lang="ts">
import { useStudioShell } from '../../composables/coforge/use-studio-app';
import CfIcon from './CfIcon.vue';

const model = useStudioShell();
</script>
<template>
  <footer class="cf-statusbar">
    <div>
      <span class="cf-status-dot is-active" />
      <span>Saved in this vault</span>
      <span class="cf-statusbar-separator">/</span>
      <CfIcon name="radio" size="xs" />
      <span>{{ model.state?.runtime.chatStatus }}</span>
    </div>
    <button type="button" @click="model.store.navigate('workflow')">
      <CfIcon name="bot" size="xs" />
      {{ model.activeLabel }}
      <CfIcon name="chevron-right" size="xs" />
    </button>
  </footer>
</template>
