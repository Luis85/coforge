<script setup lang="ts">
import { useTwitchOperationsSection } from '../../composables/coforge/use-twitch-operations';
const model = useTwitchOperationsSection();
</script>
<template>
  <section class="cf-twitch-operation-report" aria-label="Private stream report">
    <h2>Review the stream</h2>
    <p>Export collected Twitch activity with recorded stream samples. Refreshed clips and markers are included as current channel data, separately from the selected stream. Missing intervals remain visible; this report does not estimate revenue or complete viewer watch time.</p>
    <div class="cf-twitch-operation-read-toolbar">
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.canLoadStreams || model.store.busy" @click="model.loadStreams()">Load recorded streams</button>
      <label class="cf-field"><span>Report coverage</span><select v-model="model.store.reportStream"><option value="">All retained Twitch activity</option><option v-for="stream in model.store.streams" :key="stream.id" :value="stream.id">{{ model.time(stream.startedAt) }} · channel {{ stream.channelId }}</option></select></label>
      <button type="button" class="cf-btn cf-btn-primary" :disabled="!model.canReport || model.store.busy" @click="model.exportReport()">Export private report</button>
    </div>
    <details v-if="model.store.report"><summary>Exported report text</summary><pre class="cf-twitch-operation-report-text">{{ model.store.report }}</pre></details>
  </section>
</template>
