<script setup lang="ts">
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
import CfIcon from './CfIcon.vue';

const drawer = useIdeaDrawerContext();
</script>
<template>
  <section class="cf-idea-section">
    <h3><CfIcon name="history" /> Idea timeline</h3>
    <ol v-if="drawer.activity.length > 0" class="cf-idea-timeline">
      <li v-for="event in drawer.activity" :key="event.id">
        <span class="cf-idea-timeline-dot" :class="`is-${event.type}`" aria-hidden="true" />
        <div>
          <p>{{ event.text }}</p>
          <time :datetime="event.createdAt">{{ event.when }}</time>
        </div>
      </li>
    </ol>
    <p v-else class="cf-idea-help">Activity will appear here as the community and agents move this idea forward.</p>
  </section>
  <section class="cf-idea-section">
    <h3><CfIcon name="bot" /> Agent runs</h3>
    <details v-for="job in drawer.jobs" :key="job.id" class="cf-idea-run">
      <summary>
        <span class="cf-idea-inline">
          <span class="cf-idea-job-dot" :class="`is-${job.status}`" aria-hidden="true" />
          {{ job.label }}
          <span class="cf-idea-source">{{ job.provider }}</span>
        </span>
        <span class="cf-muted">{{ job.status }}</span>
      </summary>
      <pre class="cf-idea-code">{{ job.log }}</pre>
    </details>
    <p v-if="drawer.jobs.length === 0" class="cf-idea-help">No agent runs yet.</p>
  </section>
</template>
