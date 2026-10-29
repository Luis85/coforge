<script setup lang="ts">
import type { CouncilCatalogueActions } from '../../../features/coforge/application/council-catalogue';
import { useCoWorkerInventory } from '../../composables/coforge/use-coworkers';
import CouncilDefinitionEditor from './CouncilDefinitionEditor.vue';
import CfIcon from './CfIcon.vue';
const props = defineProps<{ catalogue: CouncilCatalogueActions }>();
const inventory = useCoWorkerInventory(props);
</script>
<template>
  <section class="cf-coworkers" aria-label="CoWorker inventory">
    <div class="cf-coworker-toolbar">
      <label class="cf-field"><span>Search CoWorkers</span><input v-model="inventory.model.store.search" type="search" placeholder="Name, role or ID" /></label>
      <label class="cf-field"><span>CoWorker status</span><select v-model="inventory.status"><option value="all">All CoWorkers</option><option value="available">Available</option><option value="disabled">Disabled</option></select></label>
      <button type="button" class="cf-btn cf-btn-primary" :disabled="inventory.model.store.busy" @click="inventory.model.createAgent()"><CfIcon name="plus" />Create CoWorker</button>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="inventory.model.store.busy" @click="inventory.model.load()">Refresh</button>
    </div>
    <p v-if="inventory.model.store.error" class="cf-inline-error" role="alert">{{ inventory.model.store.error }}</p>
    <p v-if="inventory.model.store.notice" role="status">{{ inventory.model.store.notice }}</p>
    <details v-if="inventory.model.catalogue.invalid.length"><summary>Definitions need repair</summary><ul><li v-for="item in inventory.model.catalogue.invalid" :key="item.path"><code>{{ item.path }}</code>: {{ item.reason }}</li></ul></details>
    <div class="cf-coworker-workspace">
      <div class="cf-coworker-library">
        <p class="cf-settings-help">{{ inventory.entries.length }} shown · {{ inventory.total }} saved in this vault</p>
        <nav aria-label="Saved CoWorkers" class="cf-coworker-cards">
          <button v-for="entry in inventory.entries" :key="entry.definition.id" type="button" class="cf-coworker-card" :aria-current="inventory.model.store.draft?.id === entry.definition.id ? 'true' : undefined" @click="inventory.model.select(entry)">
            <span class="cf-coworker-avatar"><CfIcon name="user-round" /></span>
            <span class="cf-sr-only">Edit </span>
            <strong>{{ entry.definition.name }}</strong>
            <span>{{ entry.definition.enabled ? 'Available' : 'Disabled' }}</span>
            <template v-if="entry.definition.schema === 'agent/v1'"><span>{{ entry.definition.role || 'No role specified' }}</span><small>{{ entry.definition.provider === 'demo' ? 'Simulation' : entry.definition.provider === 'claude' ? 'Claude Code' : 'Herdr · unavailable' }} · {{ entry.definition.model }}</small></template>
            <small>{{ inventory.membership(entry.definition.id).join(', ') || 'No team memberships' }}</small>
            <small v-if="inventory.model.changed(entry.definition.id)">Unsaved changes</small>
          </button>
        </nav>
        <div v-if="!inventory.entries.length" class="cf-intent-empty"><h2>{{ inventory.total ? 'No matching CoWorkers' : 'Create your first CoWorker' }}</h2><p>{{ inventory.total ? 'Change the search or status filter to see your CoWorkers.' : 'Give a specialist a role, instructions and a provider. Add them to project teams when ready.' }}</p></div>
        <section v-if="inventory.model.unsaved.length" aria-label="Unsaved CoWorker drafts"><h2>Unsaved drafts</h2><button v-for="item in inventory.model.unsaved" :key="item.definition.id" type="button" class="cf-btn cf-btn-ghost" @click="inventory.model.restoreDraft(item.definition.id)">{{ item.definition.name }} · Draft</button></section>
      </div>
      <section class="cf-coworker-editor" aria-label="CoWorker editor">
        <template v-if="inventory.model.store.draft"><h2>{{ inventory.model.store.draft.name || 'New CoWorker' }}</h2><CouncilDefinitionEditor coworker /></template>
        <div v-else class="cf-intent-empty"><CfIcon name="user-round" size="lg" /><h2>Choose a CoWorker</h2><p>Select a saved specialist or create one. Editing never starts a run; existing runs retain their captured definitions.</p></div>
      </section>
    </div>
  </section>
</template>
