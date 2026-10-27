<script setup lang="ts">
import { useStreamHistory } from "../../composables/coforge/use-stream-history";
const model = useStreamHistory();
</script>
<template>
  <section class="cf-stream-history" aria-label="Stream JSON history">
    <h2>Stream history</h2>
    <p role="status">{{ model.message }}</p>
    <p>
      One JSON object per stream in <code>CoForge/Streams</code>, with a sample each minute while on air. Missing
      measurements are marked unavailable.
    </p>
    <p v-if="!model.supported">
      History recording and JSON export are available inside Obsidian. This preview has no recorded streams.
    </p>
    <label class="cf-field"
      ><span>Recorded stream</span
      ><select v-model="model.store.historySelection" :disabled="!model.entries.length">
        <option value="">{{ model.entries.length ? "Choose a stream" : "No streams recorded yet" }}</option>
        <option v-for="stream in model.entries" :key="stream.id" :value="stream.id">{{ model.label(stream) }}</option>
      </select></label
    >
    <p v-if="model.selected">
      {{ model.selected.samples }} samples · peak observed viewers:
      {{ model.selected.peakObservedViewers ?? "unavailable" }} · mean observed viewers:
      {{ model.selected.meanObservedViewers === null ? "unavailable" : model.selected.meanObservedViewers.toFixed(1) }}
    </p>
    <div class="cf-settings-actions">
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.working"
        @click="model.refresh()"
      >
        Refresh stream history</button
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.working || !model.selected"
        @click="model.export()"
      >
        Export stream JSON
      </button>
    </div>
    <p v-if="model.error" role="alert" class="cf-inline-error">{{ model.error }}</p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </section>
</template>
