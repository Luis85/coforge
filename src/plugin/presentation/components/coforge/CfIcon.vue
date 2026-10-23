<script setup lang="ts">
defineProps<{ name: string; size?: 'xs' | 'sm' | 'lg' }>();
</script>
<template>
  <span v-cf-icon="name" class="cf-icon" :class="size ? `cf-icon-${size}` : undefined" aria-hidden="true" />
</template>
