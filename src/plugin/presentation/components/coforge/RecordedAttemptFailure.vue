<script setup lang="ts">
import { useAttemptFailure } from '../../composables/coforge/use-attempt-failure';
const props = defineProps<{ jobId: string; withinDetails?: boolean }>();
const model = useAttemptFailure(props);
</script>
<template>
  <section v-if="model.evidence" class="cf-attempt-failure cf-idea-section" aria-label="Recorded attempt failure">
    <h4>{{ model.evidence.step }} · {{ model.evidence.status }}</h4>
    <p><strong>{{ model.evidence.summary }}</strong></p>
    <p v-if="model.evidence.legacyError" class="cf-idea-help">Recorded message: {{ model.evidence.legacyError }}</p>
    <p v-if="!model.evidence.failure" class="cf-idea-help">This historical record has no structured failure cause. An empty execution log does not establish why the attempt stopped.</p>
    <p v-if="model.evidence.unresolved" class="cf-inline-error">Original execution is not confirmed stopped. Inspect its recovery details before starting further work.</p>
    <p class="cf-idea-help">{{ model.evidence.nextStep }}</p>
    <button v-if="model.evidence.managed" type="button" class="cf-btn cf-btn-secondary" @click="model.openSessions()">Open Sessions</button>
    <component :is="model.detailsTag" :class="{ 'cf-workflow-options': model.evidence.managed }">
      <summary v-if="model.evidence.managed">Recorded attempt details</summary>
      <p v-if="model.evidence.managed && model.evidence.failure" class="cf-idea-help">Original recorded classification: {{ model.evidence.failure.summary }} {{ model.evidence.failure.nextStep }}</p>
    <p class="cf-idea-help">Original attempt <code>{{ model.evidence.attemptId }}</code><template v-if="model.evidence.runId"> · run <code>{{ model.evidence.runId }}</code></template>.</p>
    <ul class="cf-attempt-resources">
      <li>{{ model.evidence.taskAvailable ? 'Captured task available' : 'No task prompt captured' }} · {{ model.evidence.responseAvailable ? 'Captured response available' : 'No response captured' }}.</li>
      <li><template v-if="model.evidence.workspaceId">Recorded workspace <code>{{ model.evidence.workspaceId }}</code>. Its ID identifies retained state; it is not a filesystem path.</template><template v-else>No workspace captured for this attempt.</template></li>
      <li>{{ model.evidence.increment ? 'Retained changes are captured for this exact attempt.' : 'No retained changes captured for this attempt.' }}</li>
      <li v-if="!model.evidence.recoveryAvailable">No original-execution recovery metadata was captured.</li>
    </ul>
    <div class="cf-session-links">
      <button v-if="model.evidence.taskAvailable" type="button" class="cf-btn cf-btn-secondary cf-idea-small-button" @click="model.inspect('task')">Read captured task</button>
      <button v-if="model.evidence.responseAvailable" type="button" class="cf-btn cf-btn-secondary cf-idea-small-button" @click="model.inspect('response')">Read captured response</button>
      <button v-if="model.evidence.increment" type="button" class="cf-btn cf-btn-secondary cf-idea-small-button" @click="model.inspect('changes')">Read retained changes</button>
      <button v-if="model.evidence.recoveryAvailable" type="button" class="cf-btn cf-btn-secondary cf-idea-small-button" @click="model.inspect('recovery')">Inspect original execution</button>
      <button v-if="!withinDetails" type="button" class="cf-btn cf-btn-ghost cf-idea-small-button" @click="model.inspect('details')">Read original attempt details</button>
    </div>
    </component>
  </section>
</template>
