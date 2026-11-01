<script setup lang="ts">
import { useNativeWorkflowRecovery } from '../../composables/coforge/use-native-workflow-recovery';
const props = defineProps<{ jobId: string }>();
const recovery = useNativeWorkflowRecovery(props);
</script>
<template>
  <section v-if="recovery.visible && recovery.job" class="cf-idea-section cf-native-recovery" aria-label="Original native execution recovery">
    <h4>Original execution · {{ recovery.job.workflow?.step.name }}</h4>
    <p class="cf-idea-help">Parent attempt <code>{{ recovery.job.id }}</code><template v-if="recovery.job.nativeProcess"> · captured root PID {{ recovery.job.nativeProcess.identity.pid }} · observed {{ recovery.observedLabel }}</template>.</p>
    <p v-if="recovery.acknowledged" class="cf-idea-help">The operator acknowledged that the original provider and its native assistants stopped. This is a recorded human statement, not OS termination proof. Stop holds, workspace review and explicit retry still apply.</p>
    <p v-else-if="recovery.settled" class="cf-idea-help">Original owned execution is confirmed stopped. No provider or verification command was replayed. Existing Stop and review gates remain.</p>
    <template v-else>
      <p v-if="recovery.job.nativeRuntime && !recovery.job.nativeProcess" class="cf-idea-help">Private preparation was interrupted before a provider process was recorded. Recovery cleans the attributable private runtime; it never starts a provider.</p>
      <p v-else class="cf-idea-help">Check the captured provider process and original Docker engine. Recovery stops owned original processes and containers; it never starts a provider or replays a command. Restore the original Docker runtime if it is unavailable.</p>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="recovery.busy" @click="recovery.check()">{{ recovery.busy ? 'Checking original execution…' : 'Check original execution' }}</button>
      <p v-if="recovery.review.reason" class="cf-idea-help">{{ recovery.review.reason }}</p>
      <label v-if="recovery.review.identity" class="cf-workflow-check"><input v-model="recovery.confirmed" type="checkbox" :disabled="recovery.busy" aria-label="I inspected the original provider and its native assistants and they have stopped" />I inspected the original provider and its native assistants and they have stopped.</label>
      <button v-if="recovery.review.identity" type="button" class="cf-btn cf-btn-secondary" :disabled="recovery.busy || !recovery.confirmed" @click="recovery.acknowledge()">Record operator acknowledgement</button>
      <p v-if="recovery.review.identity" class="cf-idea-help">This acknowledges provider cessation only. It does not prove a test outcome, release a Stop hold, start a retry or accept changes.</p>
    </template>
    <p v-if="recovery.error" class="cf-inline-error" role="alert">{{ recovery.error }}</p>
    <p v-else-if="recovery.job.error" class="cf-inline-error">{{ recovery.job.error }}</p>
  </section>
</template>
