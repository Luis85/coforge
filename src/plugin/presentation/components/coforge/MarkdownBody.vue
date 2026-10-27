<script setup lang="ts">
import { useMarkdown } from "../../composables/coforge/use-markdown";
const props = defineProps<{
  source: string;
  compact?: boolean;
  links?: boolean;
}>();
const model = useMarkdown(props);
</script>
<template><component :is="model.content" /></template>
