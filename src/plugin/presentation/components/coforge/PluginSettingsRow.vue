<script setup lang="ts">
defineProps<{ name: string; description?: string; controlId?: string }>();
</script>
<template>
  <div class="cf-setting-row">
    <div class="cf-setting-row-info">
      <label v-if="controlId" class="cf-setting-row-name" :for="controlId">{{ name }}</label>
      <div v-else class="cf-setting-row-name">{{ name }}</div>
      <div :id="controlId ? `${controlId}-desc` : undefined" class="cf-setting-row-description">
        <slot name="description">{{ description }}</slot>
      </div>
    </div>
    <div class="cf-setting-row-control">
      <slot />
    </div>
  </div>
</template>
