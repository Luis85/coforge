<script setup lang="ts">
import { useScreen } from '../../composables/use-screen.ts';

const model = useScreen("node-2");
</script>
<template>
  <section class="generated-screen" :aria-labelledby="model.headingId">
    <h2 :id="model.headingId">{{ model.screen.label }}</h2>
    <p>{{ model.screen.goal }}</p>

    <section v-for="flow in model.flows" :key="flow.id" :aria-label="flow.label">
      <button type="button" :disabled="flow.pending || flow.requiresInput" @click="flow.run()">{{ flow.label }}</button>
      <p v-if="flow.requiresInput">Implement the input mapping before enabling this action.</p>
      <p v-if="flow.error" role="status">{{ flow.error }}</p>
    </section>
    <button v-for="edge in model.edges" :key="edge.id" type="button" @click="model.follow(edge.id)">{{ edge.label }}</button>
    <p v-if="model.message.value" role="status">{{ model.message.value }}</p>
  </section>
</template>
