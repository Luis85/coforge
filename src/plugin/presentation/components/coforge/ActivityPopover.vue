<script setup lang="ts">
import { useStudioShell } from '../../composables/coforge/use-studio-app';
import CfIcon from './CfIcon.vue';

const model = useStudioShell();
</script>
<template>
  <aside class="cf-activity-popover" aria-label="Studio activity">
    <header>
      <h2>Studio activity</h2>
      <button type="button" class="cf-icon-button" aria-label="Close activity" @click="model.store.activityOpen = false">
        <CfIcon name="x" />
      </button>
    </header>
    <p class="cf-activity-intent">Recent changes across projects. Select a request event to inspect its details.</p>
    <div>
      <button
        v-for="event in model.events" :key="event.id" type="button" class="cf-activity-item" :disabled="!event.ideaId"
        @click="model.openEvent(event.ideaId)"
      >
        <span class="cf-activity-dot" :class="`cf-activity-${event.type}`" />
        <div>
          <p>{{ event.text }}</p>
          <time>{{ event.when }}</time>
        </div>
        <CfIcon v-if="event.ideaId" name="arrow-up-right" size="sm" />
      </button>
      <p v-if="!model.events.length" class="cf-muted cf-empty-state">Activity appears as your community contributes.</p>
    </div>
  </aside>
</template>
