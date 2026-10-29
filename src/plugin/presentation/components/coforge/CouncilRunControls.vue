<script setup lang="ts">
import type { ExecutionRun } from '../../../features/coforge/domain/execution-run';
import { useCouncilModel } from '../../composables/coforge/use-council';
defineProps<{ run: ExecutionRun }>();
const model = useCouncilModel();
</script>
<template>
  <div class="cf-settings-actions" role="group" :aria-label="`Run actions for ${model.display.title(run)}`">
    <button v-if="run.state === 'publishing'" type="button" class="cf-btn cf-btn-primary" :disabled="model.store.busy || !model.store.state?.executor || run.attempts.some(attempt => attempt.status === 'dispatching')" @click="model.repair(run.id)">Repair note publication</button>
    <button v-if="run.state === 'queued' || run.state === 'running'" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.pauseRun(run.id, !run.pauseRequested)">{{ run.pauseRequested ? 'Resume this run' : 'Pause this run' }}</button>
    <button v-if="run.state !== 'completed' && run.state !== 'cancelled'" type="button" class="cf-btn cf-btn-ghost" :disabled="model.store.busy" @click="model.cancel(run.id)">Cancel future work</button>
    <button v-if="run.state === 'completed' || run.state === 'cancelled'" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.runAgain(run.subject.sourceId)">Run again as new generation</button>
  </div>
</template>
