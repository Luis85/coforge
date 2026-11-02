<script setup lang="ts">
import { useAttemptFailure } from '../../composables/coforge/use-attempt-failure';
import ReadableContent from './ReadableContent.vue';
const props = defineProps<{ jobId: string }>();
const model = useAttemptFailure(props);
</script>
<template>
  <section v-if="model.evidence?.increment" class="cf-idea-section" data-attempt-section="changes" aria-label="Retained changes for original attempt">
    <h4>Retained changes · {{ model.evidence.attemptId }}</h4>
    <p class="cf-idea-help">Captured for this exact attempt. These changes have not been accepted through this view.</p>
    <ReadableContent :source="model.evidence.increment.summary" original-label="Original retained change summary" />
    <ul><li v-for="file in model.evidence.increment.files.slice(0, 20)" :key="file.path"><code>{{ file.path }}</code> · +{{ file.additions }} / −{{ file.deletions }}</li></ul>
    <p v-if="model.evidence.increment.files.length > 20" class="cf-idea-help">Showing 20 of {{ model.evidence.increment.files.length }} captured files.</p>
    <details class="cf-idea-evidence"><summary>Read captured diff</summary><pre class="cf-idea-code" aria-label="Captured diff for original attempt">{{ model.evidence.increment.diff }}</pre></details>
  </section>
</template>
