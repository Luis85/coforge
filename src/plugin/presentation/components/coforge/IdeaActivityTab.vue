<script setup lang="ts">
import { useIdeaDrawerContext } from '../../composables/coforge/use-idea-drawer';
import CfIcon from './CfIcon.vue';
import IdeaRunHistory from './IdeaRunHistory.vue';
import NativeWorkflowRecovery from './NativeWorkflowRecovery.vue';

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
    <p v-if="drawer.jobs.length" class="cf-idea-help">Expand a run to inspect its chat history and execution log.</p>
    <details v-for="job in drawer.jobs" :key="job.id" class="cf-idea-run" :data-job-id="job.id">
      <summary>
        <CfIcon name="chevron-right" class="cf-idea-run-chevron" size="sm" />
        <span class="cf-idea-run-heading">
          <span class="cf-idea-inline cf-idea-wrap">
            <span class="cf-idea-job-dot" :class="`is-${job.status}`" aria-hidden="true" />
            <strong>{{ job.label }}</strong>
            <span class="cf-idea-source">{{ job.provider }}<template v-if="job.model"> · {{ job.model }}</template><template v-if="job.effort"> · {{ job.effort }} effort</template></span>
          </span>
          <span class="cf-idea-run-meta">
            {{ job.simulated ? 'Simulation' : 'Chat history' }} · <time :datetime="job.startedAt" :title="job.startedAt">{{ job.startedLabel }}</time>
          </span>
        </span>
        <span class="cf-muted cf-idea-run-status">{{ job.status }}</span>
      </summary>
      <IdeaRunHistory :job="job" />
      <NativeWorkflowRecovery :job-id="job.id" />
    </details>
    <p v-if="drawer.jobs.length === 0" class="cf-idea-help">No agent runs yet.</p>
  </section>
</template>
