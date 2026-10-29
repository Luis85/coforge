<script setup lang="ts">
import { useCouncil } from '../../composables/coforge/use-council';
import CoWorkerInventory from './CoWorkerInventory.vue';
const model = useCouncil();
</script>
<template>
  <div class="cf-coworkers-page">
    <header class="cf-page-heading"><div><h1>CoWorkers</h1><p>Create reusable specialists, refine their instructions and manage availability across project teams.</p></div></header>
    <p v-if="model.example" role="status">CoWorker example · temporary definitions only. No vault notes, native providers or external services are changed.</p>
    <div v-if="!model.service" class="cf-intent-empty"><h2>Your vault's CoWorkers</h2><p>Open CoForge in desktop Obsidian to manage your specialists, or explore a temporary example.</p><button v-if="model.canPreview" type="button" class="cf-btn cf-btn-secondary" @click="model.explore()">Explore CoWorkers example</button></div>
    <template v-else><button v-if="model.example" type="button" class="cf-btn cf-btn-ghost" @click="model.exitExample()">Exit example</button><CoWorkerInventory :catalogue="model.service.catalogue" /></template>
  </div>
</template>
