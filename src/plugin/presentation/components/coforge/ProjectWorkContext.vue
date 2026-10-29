<script setup lang="ts">
import { useProjectWorkContext } from '../../composables/coforge/use-project-work-context';
import CfIcon from './CfIcon.vue';
withDefaults(defineProps<{ showAutomation?: boolean }>(), { showAutomation: true });
const model = useProjectWorkContext();
</script>
<template>
  <section v-if="model.summary" class="cf-project-work-context" aria-label="Selected project context">
    <div class="cf-project-work-identity">
      <CfIcon name="folder-git-2" size="lg" />
      <div><strong>{{ model.summary.name }}</strong><code>{{ model.summary.id }}</code></div>
      <span v-if="model.summary.visibility === 'private'" class="cf-badge">Private project</span>
      <span v-if="showAutomation || model.summary.unavailable" class="cf-badge" :class="{ 'is-attention': model.summary.unavailable }">{{ model.summary.unavailable ? 'Project note unavailable' : model.summary.paused ? 'Request automation paused' : 'Request automation resumed' }}</span>
    </div>
    <button type="button" class="cf-btn cf-btn-ghost" @click="model.openProjects()">Change project<CfIcon name="chevron-right" size="sm" /></button>
  </section>
</template>
