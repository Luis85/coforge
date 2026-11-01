<script setup lang="ts">
import { useRequestDeleteControl } from '../../composables/coforge/use-request-deletion';
import CfIcon from './CfIcon.vue';
const props = defineProps<{ ideaId: string; iconOnly?: boolean }>();
const model = useRequestDeleteControl(props);
</script>
<template>
  <button type="button" :class="iconOnly ? 'cf-icon-button' : 'cf-btn cf-btn-ghost cf-idea-small-button'" :aria-label="`Delete request ${ideaId}`" :aria-description="model.reason || undefined" :disabled="model.blocked" :title="model.reason || 'Delete request'" @click="model.open($event)">
    <CfIcon name="trash-2" /><span v-if="!iconOnly">Delete request</span>
  </button>
</template>
