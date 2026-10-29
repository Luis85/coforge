<script setup lang="ts">
import { useServiceDesign } from '../../composables/coforge/use-service-design';
import BlueprintGrid from './BlueprintGrid.vue';
import BlueprintEditor from './BlueprintEditor.vue';
const model = useServiceDesign();
</script>
<template>
  <div class="cf-page cf-service-design" :aria-busy="model.store.busy">
    <header class="cf-page-heading">
      <div><h1>Service Design</h1><p>Connect the customer journey to the people, evidence and processes that deliver your service.</p></div>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.available || model.store.busy" @click="model.refresh()">Refresh blueprint</button>
    </header>
    <p v-if="model.store.error" class="cf-error" role="alert">{{ model.store.error }}</p>
    <p v-if="model.store.notice" class="cf-settings-help" role="status">{{ model.store.notice }}</p>
    <div v-if="model.store.catalogue.warnings.length" class="cf-blueprint-warnings" role="alert">
      <h2>Notes need attention</h2><p>Resolve these invalid or duplicate notes in Obsidian, then refresh. Saved notes and drafts are retained.</p>
      <ul><li v-for="warning in model.store.catalogue.warnings" :key="warning">{{ warning }}</li></ul>
    </div>
    <div v-if="!model.available" class="cf-intent-empty"><h2>Your project’s service blueprint</h2><p>Open CoForge in desktop Obsidian to create your blueprint and save linked Markdown notes in your vault.</p></div>
    <div v-else-if="!model.project" class="cf-intent-empty"><h2>Choose a project to design its service</h2><p>Use the project switcher to choose or create a project. Each project has its own service blueprint.</p></div>
    <template v-else-if="model.store.loaded">
      <section v-if="!model.blueprint" class="cf-blueprint-start" aria-label="Start service blueprint">
        <h2>Map how your service works</h2><p>Start with a service and customer goal. Add journey steps in order, then connect what the customer sees to the work behind it.</p>
        <button type="button" class="cf-btn cf-btn-primary" :disabled="model.store.busy" @click="model.begin('blueprint')">Create service blueprint</button>
      </section>
      <template v-else>
        <section class="cf-blueprint-overview" aria-label="Service blueprint overview">
          <div><h2>{{ model.blueprint.title }}</h2><p>{{ model.steps.length }} journey {{ model.steps.length === 1 ? 'step' : 'steps' }} · {{ model.totalEntities }} entities</p></div>
          <div class="cf-blueprint-actions"><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.select(model.blueprint)">Edit blueprint</button><button type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.open(model.blueprint.id)">Open blueprint note</button></div>
        </section>
        <div class="cf-blueprint-toolbar">
          <label class="cf-field"><span>New entity type</span><select v-model="model.session.newKind" aria-label="New entity type" :disabled="model.store.busy"><option v-for="kind in model.kinds" :key="kind" :value="kind">{{ model.labels[kind] }}</option></select></label>
          <button type="button" class="cf-btn cf-btn-primary" :disabled="model.store.busy" @click="model.begin(model.session.newKind)">Add entity</button>
        </div>
        <BlueprintGrid :model="model" />
      </template>
      <div v-if="model.session.pending" :ref="model.bindReplacement" class="cf-blueprint-confirm" role="region" aria-label="Unsaved entity draft" tabindex="-1">
        <h2>Keep your current draft?</h2><p>You have unsaved changes. Save them first, or discard them to open the selected entity.</p>
        <div class="cf-blueprint-actions"><button type="button" class="cf-btn cf-btn-secondary" @click="model.cancelReplace()">Keep editing</button><button type="button" class="cf-btn cf-btn-danger" @click="model.replace()">Discard draft and continue</button></div>
      </div>
      <BlueprintEditor v-if="model.session.draft" :model="model" />
      <section v-if="model.blueprint" class="cf-blueprint-inventory" aria-label="Service Design entities">
        <header><h2>Entities &amp; relationships</h2><p>Reuse actors, touchpoints and systems across the journey. Record pain points and opportunities alongside the work they affect.</p></header>
        <label class="cf-field"><span>Find entities</span><input v-model="model.session.filter" type="search" placeholder="Title or entity type" /></label>
        <ul v-if="model.entities.length" class="cf-blueprint-entity-list"><li v-for="entity in model.entities" :key="entity.id"><button type="button" :aria-current="model.session.draft?.id === entity.id ? 'true' : undefined" :disabled="model.store.busy" @click="model.select(entity)"><strong>{{ entity.title }}</strong><span>{{ model.labels[entity.kind] }}</span></button></li></ul>
        <p v-else class="cf-settings-help">{{ model.session.filter ? 'No matching entities. Try another title or type.' : 'No entities yet. Add one from the toolbar or a blueprint cell.' }}</p>
      </section>
      <details class="cf-blueprint-storage"><summary>Note storage</summary><p>Private Markdown notes are grouped by project. This vault-wide folder applies to new notes; existing notes remain in their original folders and stay discoverable.</p>
        <form class="cf-blueprint-toolbar" @submit.prevent="model.configure()"><label class="cf-field"><span>Service Design folder</span><input v-model="model.store.folder" type="text" required maxlength="200" :disabled="model.store.busy" /></label><button class="cf-btn cf-btn-secondary" type="submit" :disabled="model.store.busy">Save folder</button></form>
      </details>
    </template>
    <p v-else role="status">Loading Service Design notes…</p>
  </div>
</template>
