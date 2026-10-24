<script setup lang="ts">
import { useStudioStore } from '../../stores/coforge-studio';
import CfIcon from './CfIcon.vue';

const store = useStudioStore();
</script>
<template>
  <div class="cf-toast-stack" role="status" aria-live="polite">
    <div v-for="toast in store.toasts" :key="toast.id" class="cf-toast" :class="{ 'cf-toast-error': toast.error }">
      <CfIcon :name="toast.error ? 'circle-alert' : 'check'" />
      <span>{{ toast.message }}</span>
      <button type="button" class="cf-icon-button" aria-label="Dismiss notification" @click="store.dismiss(toast.id)">
        <CfIcon name="x" size="sm" />
      </button>
    </div>
  </div>
</template>
