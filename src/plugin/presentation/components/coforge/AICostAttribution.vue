<script setup lang="ts">
import type { useAICosts } from '../../composables/coforge/use-ai-costs';
defineProps<{ model: ReturnType<typeof useAICosts> }>();
</script>
<template>
  <section class="cf-ai-attribution" aria-label="Agent, team and Council cost attribution">
    <h2>Who used the AI budget</h2>
    <p>Historical identities come from each captured run. Choose a dimension to regroup the same attempts; a task can belong to an agent, team and Council.</p>
    <p class="cf-ai-attribution-coverage" aria-label="Attribution coverage">Recorded attribution: agent {{ model.attributionCoverage.agent }}/{{ model.attributionCoverage.total }} · team {{ model.attributionCoverage.team }}/{{ model.attributionCoverage.total }} · Council membership {{ model.attributionCoverage.council }}/{{ model.attributionCoverage.total }}. Direct agent work has no Council.</p>
    <div class="cf-ai-attribution-filters">
      <label>Agent<select :value="model.store.agent" @change="model.filterAttribution('agent', $event)"><option value="">All agents</option><option value="__unattributed__">Unattributed agents</option><option v-for="group in model.attributionOptions('agent')" :key="group.id" :value="group.id">{{ group.name }} · {{ group.id }}</option></select></label>
      <label>Team<select :value="model.store.team" @change="model.filterAttribution('team', $event)"><option value="">All teams</option><option value="__unattributed__">Unattributed teams</option><option v-for="group in model.attributionOptions('team')" :key="group.id" :value="group.id">{{ group.name }} · {{ group.project }}</option></select></label>
      <label>Council<select :value="model.store.council" @change="model.filterAttribution('council', $event)"><option value="">All Councils</option><option value="__unattributed__">No recorded Council</option><option v-for="group in model.attributionOptions('council')" :key="group.id" :value="group.id">{{ group.name }} · {{ group.project }}</option></select></label>
    </div>
    <button v-if="model.store.agent || model.store.team || model.store.council" type="button" class="cf-btn cf-btn-ghost" @click="model.clearAttribution()">Clear attribution filters</button>
    <nav aria-label="Cost attribution groups" class="cf-ai-attribution-tabs"><button v-for="dimension in model.dimensions" :key="dimension.id" type="button" class="cf-btn cf-btn-secondary" :aria-pressed="model.store.dimension === dimension.id" @click="model.chooseDimension(dimension.id)">{{ dimension.label }}</button></nav>
    <ul class="cf-ai-attribution-groups"><li v-for="group in model.attributionGroups.slice(0, 50)" :key="group.id"><button type="button" @click="model.chooseAttribution(group.dimension, group.id)"><span><strong>{{ group.name }}</strong><small>{{ group.id }}<template v-if="group.project"> · {{ group.project }}</template></small><small>{{ group.count }} attempts · {{ group.summary.reported }} reported · {{ group.summary.manual }} manual · {{ group.summary.simulations }} simulated</small></span><span><strong>{{ group.display }}</strong><small v-if="group.summary.missing || group.summary.pending">Partial · {{ group.summary.missing + group.summary.pending }} without cost</small></span></button></li></ul>
    <p v-if="!model.attributionGroups.length">No recorded {{ model.store.dimension }} identities match these filters. The task history retains unattributed attempts and their costs.</p>
    <p v-if="model.attributionGroups.length > 50">Showing 50 identities. Use the attribution filters to inspect another; totals include all matching attempts.</p>
  </section>
</template>
