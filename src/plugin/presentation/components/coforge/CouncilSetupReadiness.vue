<script setup lang="ts">
import { useCouncilEditorForm } from '../../composables/coforge/use-council-definitions';
const model = useCouncilEditorForm();
</script>
<template>
  <section class="cf-council-setup" aria-label="Council setup readiness">
    <template v-if="model.store.catalogueLoading"><h3>Loading Council configuration</h3><p role="status">Reading the saved CoWorkers, roster and Councils before checking readiness.</p></template>
    <template v-else-if="!model.store.catalogueLoaded"><h3>Configuration unavailable</h3><p>Refresh definitions to retry. Your authored drafts are kept; missing configuration is not inferred from a failed read.</p></template>
    <template v-else>
    <h3>{{ model.readiness.configured.length ? 'Council configuration' : 'Prepare your Council' }}</h3>
    <ol class="cf-council-readiness-list">
      <li>
        <div><strong>Vault CoWorkers</strong><p>{{ model.readiness.agents.length ? `${model.readiness.agents.length} enabled CoWorker${model.readiness.agents.length === 1 ? '' : 's'}` : 'No enabled CoWorkers' }}</p><span v-if="!model.readiness.agents.length">Enable saved CoWorkers and review their specialist instructions and provider.</span></div>
        <button type="button" class="cf-btn cf-btn-secondary" @click="model.manageCoWorkers()">Manage CoWorkers</button>
      </li>
      <li>
        <div><strong>Project roster</strong><p>{{ model.readiness.usableTeams.length ? 'Enabled roster with available CoWorkers' : model.readiness.teams.length ? 'Add enabled CoWorkers to a project roster' : 'No project roster yet' }}</p><span>The roster supplies members; you choose only a Council when asking a question.</span></div>
        <button v-if="!model.readiness.teams.length" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy || !model.projectId" @click="model.setup()">Create default team</button>
        <button v-else type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.select(model.readiness.usableTeams[0] ?? model.readiness.teams[0]!)">Edit project roster</button>
      </li>
      <li>
        <div><strong>Council</strong><p>{{ model.readiness.configured.length ? `${model.readiness.configured.length} configured Council${model.readiness.configured.length === 1 ? '' : 's'}` : model.readiness.councils.length ? 'Review Council membership, rounds and enabled state' : 'Create a Council from the project roster' }}</p><span>Independent opinions and solution rounds are available as the default protocol.</span></div>
        <button v-if="model.readiness.councils.length" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.select(model.readiness.configured[0] ?? model.readiness.councils[0]!)">Review Council</button>
      </li>
    </ol>
    <p>Provider readiness is checked separately in Activity → Runs &amp; answers. Saving definitions does not contact a provider, choose an execution desktop or resume work.</p>
    </template>
  </section>
</template>
