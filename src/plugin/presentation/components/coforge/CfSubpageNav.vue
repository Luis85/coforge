<script setup lang="ts" generic="T extends string">
defineProps<{
  label: string;
  items: readonly { id: T; label: string }[];
  selected: T;
}>();
defineEmits<{ select: [id: T] }>();
</script>
<template>
  <nav class="cf-subpage-nav" :aria-label="label">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :aria-current="selected === item.id ? 'page' : undefined"
      @click="$emit('select', item.id)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>
