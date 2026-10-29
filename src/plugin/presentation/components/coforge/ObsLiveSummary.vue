<script setup lang="ts">
import { useLiveStudio } from "../../composables/coforge/use-live-studio";
const model = useLiveStudio();
</script>
<template>
  <section
    class="cf-production-live-summary"
    aria-label="Current audience and stream health"
  >
    <p v-if="model.example">Example readings · synthetic data</p>
    <dl>
      <div>
        <dt>Viewers</dt>
        <dd>{{ model.viewer }}</dd>
        <small>{{ model.updated(model.state.viewers.checkedAt) }}</small>
      </div>
      <div v-for="row in model.healthRows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <p>
      {{ model.obsStatus }} {{ model.updated(model.state.obs.checkedAt) }}.
      Dropped-frame percentage is cumulative.
    </p>
  </section>
</template>
