<script setup lang="ts">
import { useStudioShell } from '../../composables/coforge/use-studio-app';
import CfIcon from './CfIcon.vue';

const model = useStudioShell();
</script>
<template>
  <header class="cf-topbar">
    <div class="cf-breadcrumb">
      <CfIcon name="gamepad-2" size="sm" />
      <span>{{ model.store.activeProject ? model.state?.settings.projectName : 'CoForge' }}</span>
      <button v-if="model.store.activeProject" type="button" class="cf-project-id-copy" :aria-label="`Copy project ID ${model.store.activeProject.id}`" @click="model.copyProjectId()"><code>{{ model.store.activeProject.id }}</code><CfIcon name="copy" size="xs" /></button>
      <CfIcon name="chevron-right" size="xs" />
      <strong>{{ model.viewLabel }}</strong>
    </div>
    <div class="cf-topbar-actions">
      <span v-if="model.store.activeProject" class="cf-provider-pill" :class="{ 'is-demo': model.isDemo }"><span />{{ model.isDemo ? 'Demo agents' : 'Claude Code CLI' }}</span>
      <span class="cf-topbar-divider" />
      <button
        type="button" class="cf-icon-button cf-activity-toggle" aria-label="Recent activity" :aria-expanded="model.store.activityOpen"
        @click="model.store.activityOpen = !model.store.activityOpen"
      >
        <CfIcon name="activity" />
        <span v-if="model.reviewCount > 0" class="cf-notification-dot" />
      </button>
    </div>
  </header>
</template>
