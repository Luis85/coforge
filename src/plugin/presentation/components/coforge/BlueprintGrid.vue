<script setup lang="ts">
import type { ServiceDesignModel } from '../../composables/coforge/use-service-design';
defineProps<{ model: ServiceDesignModel }>();
</script>
<template>
  <section class="cf-blueprint-map" aria-label="Service blueprint map">
    <div v-if="!model.steps.length" class="cf-intent-empty"><h3>Add the first journey step</h3><p>Describe what the customer is trying to do, then map how your service responds.</p><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.begin('journey-step')">Add journey step</button></div>
    <div v-else class="cf-blueprint-scroll" role="region" aria-label="Scrollable service blueprint" tabindex="0">
      <table class="cf-blueprint-grid">
        <caption>Service delivery by journey step. Select an entity to edit it, or add one within a layer.</caption>
        <thead><tr><th scope="col">Service layer</th><th v-for="step in model.steps" :key="step.id" scope="col"><button type="button" :disabled="model.store.busy" :aria-label="`Edit journey step: Step ${step.order} ${step.title}`" @click="model.select(step)"><small>{{ `Step ${step.order} ` }}</small><strong>{{ step.title }}</strong></button></th></tr></thead>
        <tbody><tr v-for="layer in model.layers" :key="layer" :class="`cf-blueprint-layer-${layer}`">
          <th scope="row"><span>{{ model.labels[layer] }}</span><small v-if="layer === 'frontstage-action'">Line of interaction</small><small v-if="layer === 'backstage-action'">Line of visibility</small><small v-if="layer === 'support-process'">Line of internal interaction</small></th>
          <td v-for="step in model.steps" :key="step.id"><div class="cf-blueprint-cell">
            <button v-for="entity in model.cells(layer, step.id)" :key="entity.id" type="button" class="cf-blueprint-node" :aria-current="model.session.draft?.id === entity.id ? 'true' : undefined" :disabled="model.store.busy" @click="model.select(entity)">{{ entity.title }}<small v-if="entity.links.length">{{ entity.links.length }} linked {{ entity.links.length === 1 ? 'entity' : 'entities' }}</small></button>
            <button type="button" class="cf-blueprint-add" :aria-label="`Add ${model.labels[layer]} to ${step.title}`" :disabled="model.store.busy" @click="model.begin(layer, step.id)">+ Add</button>
          </div></td>
        </tr></tbody>
      </table>
    </div>
  </section>
</template>
