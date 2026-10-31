<script setup lang="ts">
import { useActivityPopover } from '../../composables/coforge/use-activity-popover';
import CfIcon from './CfIcon.vue';

const model = useActivityPopover();
</script>
<template>
  <aside :ref="model.bind" class="cf-activity-popover" aria-label="Studio activity" @keydown="model.keydown">
    <header>
      <h2>Studio activity</h2>
      <button type="button" class="cf-icon-button" aria-label="Close activity" @click="model.close()">
        <CfIcon name="x" />
      </button>
    </header>
    <p class="cf-activity-intent">Recent changes across projects. Select a request event to inspect its details.</p>
    <div class="cf-activity-scroll" tabindex="0" role="region" aria-label="Recent studio events">
      <ol class="cf-activity-list">
        <li v-for="event in model.events" :key="event.id">
          <component :is="event.targetId ? 'button' : 'div'" v-bind="model.link(event.targetId)" class="cf-activity-item">
            <span class="cf-activity-dot" :class="`cf-activity-${event.type}`" aria-hidden="true" />
            <span class="cf-activity-body">
              <span class="cf-activity-message">{{ event.text }}</span>
              <time :datetime="event.createdAt" :title="event.absolute">{{ event.when }} · {{ event.absolute }}</time>
              <span v-if="event.scope" class="cf-activity-scope">{{ event.scope }}</span>
            </span>
            <span v-if="event.targetId" class="cf-activity-action" aria-hidden="true"><CfIcon name="arrow-up-right" size="sm" /></span>
          </component>
        </li>
      </ol>
      <p v-if="!model.events.length" class="cf-muted cf-empty-state">Activity appears as your community contributes.</p>
    </div>
  </aside>
</template>
