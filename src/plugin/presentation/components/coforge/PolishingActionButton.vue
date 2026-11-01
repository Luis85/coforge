<script setup lang="ts">
import { usePolishingAction } from '../../composables/coforge/use-polishing-action';
defineProps<{ ideaId: string }>();
const polishing = usePolishingAction();
</script>
<template><button type="button" class="cf-btn cf-btn-secondary" :data-polishing-trigger="ideaId" @click="polishing.open(ideaId, $event)">Improve &amp; polish</button></template>
