<script setup lang="ts">
import type { PolishingTarget } from '../../../features/coforge/domain/polishing';
import { usePolishingResultBody } from '../../composables/coforge/use-polishing-result-body';
import ReadableContent from './ReadableContent.vue';
const props = defineProps<{ value: PolishingTarget['value'] }>();
const body = usePolishingResultBody(() => props.value);
</script>
<template>
  <div class="cf-polishing-result-body">
    <template v-if="body.value.request"><h4>{{ body.value.request.title }}</h4><ReadableContent :source="body.value.request.description" /></template>
    <ReadableContent v-if="body.value.markdown" :source="body.value.markdown" />
    <template v-if="body.value.screening"><p>{{ body.value.screening.verdict }}</p><ReadableContent :source="body.value.screening.reason" /><ul><li v-for="signal in body.value.screening.signals" :key="signal">{{ signal }}</li></ul></template>
    <template v-if="body.value.rice"><p>Reach {{ body.value.rice.reach }} · impact {{ body.value.rice.impact }} · confidence {{ body.value.rice.confidence }} · effort {{ body.value.rice.effort }}</p><ReadableContent :source="body.value.rice.rationale" /></template>
    <ReadableContent v-if="body.plan" :source="body.plan" />
    <template v-if="body.value.increment"><ReadableContent :source="body.value.increment.summary" /><ul><li v-for="file in body.value.increment.files" :key="file.path"><code>{{ file.path }}</code> · +{{ file.additions }} / −{{ file.deletions }}</li></ul><pre class="cf-workflow-code-block" tabindex="0">{{ body.value.increment.diff }}</pre><p>Recorded tests: {{ body.value.increment.tests.join(', ') || 'None reported' }}. Inspect the evidence; a model report alone is not host verification.</p></template>
    <ReadableContent v-if="body.value.summary" :source="body.value.summary" />
  </div>
</template>
