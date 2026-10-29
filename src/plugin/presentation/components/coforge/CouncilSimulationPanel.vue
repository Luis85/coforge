<script setup lang="ts">
import { useCouncilModel } from '../../composables/coforge/use-council';
withDefaults(defineProps<{ taskIntake?: boolean }>(), { taskIntake: false });
const model = useCouncilModel();
</script>
<template>
  <details :open="taskIntake && model.ask.simulationPreview">
    <summary>Test with deterministic simulation</summary>
    <p>Choose a new note inside CoForge/Tests. Simulation captures and validates the question, produces marked fake outputs there and sends no model requests.</p>
    <label class="cf-field"><span>Simulation destination</span><input v-model="model.store.destination" placeholder="CoForge/Tests/Council trial.md"></label>
    <button type="button" class="cf-btn" :class="taskIntake && model.ask.simulationPreview ? 'cf-btn-primary' : 'cf-btn-secondary'" :disabled="model.store.busy || !model.store.state?.executor || !model.store.source" @click="model.simulate()">Queue simulation</button>
  </details>
</template>
