<script setup lang="ts">
import { useCouncilActivity } from '../../composables/coforge/use-council-activity';
const model = useCouncilActivity();
</script>
<template>
  <section class="cf-council-activity" aria-label="Council activity">
    <div role="status" aria-live="polite" aria-atomic="true">
      <strong>{{ model.execution }}</strong>
      <span>{{ model.active }} active · {{ model.queued }} queued · {{ model.attention }} need attention or your decision</span>
      <p>{{ model.current }}</p>
      <time v-if="model.latest" :datetime="model.latest.updatedAt">Last activity: {{ model.updated }}</time>
    </div>
    <button type="button" class="cf-btn cf-btn-secondary" @click="model.inspect()">View activity</button>
  </section>
</template>
