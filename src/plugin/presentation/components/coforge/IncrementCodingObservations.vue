<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIncrementCodingObservations, type ProducingCodingAttempt } from '../../composables/coforge/use-increment-coding-observations';
const props = defineProps<{ idea: Idea; source?: ProducingCodingAttempt }>();
const observations = useIncrementCodingObservations(props);
</script>
<template>
  <section v-if="observations.model" class="cf-idea-section" :aria-label="observations.model.title">
    <h3>{{ observations.model.title }}</h3>
    <p class="cf-idea-help">{{ observations.model.help }}</p>
    <p class="cf-idea-help">Producing run <code>{{ observations.model.runId }}</code> · attempt <code>{{ observations.model.attemptId }}</code> · <code>{{ observations.model.profile.profile }}</code>.</p>
    <p class="cf-idea-help">{{ observations.model.historical ? 'Recorded before Apply; not rerun in this worktree.' : 'Recorded on the producing attempt. No current-source comparison is established by this transcript.' }}</p>
    <p v-if="observations.model.truncated" class="cf-idea-help">Earlier observations were truncated. Missing command details and outcomes are not reconstructed.</p>
    <details v-for="entry in observations.model.entries" :key="entry.sequence" class="cf-idea-evidence">
      <summary>{{ entry.heading }} · {{ entry.status || 'Outcome not recorded' }}<span class="cf-idea-run-meta">{{ entry.actor }} · <time :datetime="entry.observedAt">{{ entry.timeLabel }}</time></span></summary>
      <pre class="cf-idea-code" tabindex="0" role="region" :aria-label="`Captured tool observation ${entry.sequence}`">{{ entry.text || 'No command or output text captured for this observation.' }}</pre>
    </details>
    <p v-if="!observations.model.entries.length" class="cf-idea-help">No tool or command observations were captured for this producing attempt. An agent’s written test notes remain a separate claim.</p>
  </section>
</template>
