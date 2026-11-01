<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useCurrentPolishedResult } from '../../composables/coforge/use-current-polished-result';
import PolishingResultBody from './PolishingResultBody.vue';
const props = defineProps<{ idea: Idea }>();
const model = useCurrentPolishedResult(() => props.idea);
</script>
<template>
  <section v-if="model.current" class="cf-background-build-retry cf-background-build-preview" aria-label="Current polished result">
    <h3>Current polished result</h3>
    <p class="cf-settings-help">{{ model.label }} · approved and current. The original request and earlier workflow evidence remain retained.</p>
    <dl class="cf-background-build-facts">
      <div v-if="model.current.sourceRunId"><dt>Result produced by run</dt><dd>{{ model.current.sourceRunId }} · artifact {{ model.current.sourceArtifactId }}</dd></div>
      <div v-if="model.current.workspaceOwnerRunId"><dt>Current workspace owner</dt><dd>{{ model.current.workspaceOwnerRunId }} · {{ model.current.workspaceId }}</dd></div>
    </dl>
    <PolishingResultBody :value="model.current.value" />
  </section>
</template>
