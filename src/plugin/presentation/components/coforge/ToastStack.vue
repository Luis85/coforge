<script setup lang="ts">
import { useStudioStore } from '../../stores/coforge-studio';
import CfIcon from './CfIcon.vue';
import { useToastPlacement } from '../../composables/coforge/use-toast-placement';

const store = useStudioStore();
const placement = useToastPlacement();
</script>
<template>
  <div :ref="placement.bind" class="cf-toast-stack" :style="placement.style.value" role="region" aria-label="Notifications">
    <div v-for="toast in store.toasts" :key="toast.id" class="cf-toast" :class="{ 'cf-toast-error': toast.error }">
      <CfIcon :name="toast.error ? 'circle-alert' : 'check'" />
      <span class="cf-notice-body" :role="toast.error ? 'alert' : 'status'" aria-atomic="true">{{ toast.message }}</span>
      <button type="button" class="cf-icon-button" aria-label="Dismiss notification" @click="store.dismiss(toast.id)">
        <CfIcon name="x" size="sm" />
      </button>
    </div>
  </div>
</template>
