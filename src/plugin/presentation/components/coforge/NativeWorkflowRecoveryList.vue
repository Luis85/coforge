<script setup lang="ts">
import { useNativeWorkflowRecoveryJobs } from '../../composables/coforge/use-native-workflow-recovery';
import NativeWorkflowRecovery from './NativeWorkflowRecovery.vue';
const props = defineProps<{ ideaId: string; runId?: string }>();
const recovery = useNativeWorkflowRecoveryJobs(props);
</script>
<template>
  <NativeWorkflowRecovery v-for="job in recovery.jobs" :key="job.id" :job-id="job.id" />
</template>
