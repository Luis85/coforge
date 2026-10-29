<script setup lang="ts">
import { useBlueprintDraft, type ServiceDesignModel } from '../../composables/coforge/use-service-design';
import MarkdownBody from './MarkdownBody.vue';
defineProps<{ model: ServiceDesignModel }>();
const editor = useBlueprintDraft();
</script>
<template>
  <form v-if="editor.draft" class="cf-blueprint-editor" aria-label="Service Design entity editor" @submit.prevent="model.save()">
    <header><h2>{{ editor.draft.id ? 'Edit' : 'Create' }} {{ model.labels[editor.draft.kind].toLowerCase() }}</h2><span v-if="model.dirty" class="cf-settings-help">Unsaved changes</span></header>
    <fieldset :disabled="model.store.busy || model.session.pending !== null">
      <div class="cf-blueprint-fields">
        <label class="cf-field"><span>Entity title</span><input :ref="model.bindTitle" v-model="editor.draft.title" type="text" maxlength="200" required /></label>
        <label class="cf-field"><span>Order</span><input v-model.number="editor.draft.order" type="number" min="0" max="100000" step="1" required /></label>
        <label v-if="editor.draft.kind !== 'blueprint' && editor.draft.kind !== 'journey-step'" class="cf-field"><span>Journey step</span><select v-model="editor.draft.stepId" aria-label="Journey step" :required="model.needsStep"><option value="">{{ model.needsStep ? 'Choose a journey step' : 'Across the service' }}</option><option v-for="step in model.steps" :key="step.id" :value="step.id">{{ step.title }}</option></select></label>
      </div>
      <p class="cf-settings-help">Lower order numbers appear first. Entries with the same order are sorted by title.</p>
      <p v-if="model.needsStep && !model.steps.length" class="cf-settings-help">Save a journey step first, then add this layer to it.</p>
      <p v-if="editor.draft.kind === 'blueprint'" class="cf-settings-help">Describe the customer, scenario and service goal. Note whether this blueprint maps the current service or a desired future service.</p>
      <label class="cf-field"><span>Markdown notes</span><textarea v-model="editor.draft.body" rows="7" maxlength="100000" placeholder="Describe the service, customer goal, activity or evidence. Markdown and [[wikilinks]] are supported." /></label>
      <details v-if="editor.draft.body" class="cf-blueprint-preview"><summary>Preview Markdown</summary><MarkdownBody :source="editor.draft.body" /></details>
      <div v-if="model.linked.length" class="cf-blueprint-related-links"><span>Explore related entities</span><div class="cf-blueprint-actions"><button v-for="entry in model.linked" :key="entry.id" type="button" class="cf-btn cf-btn-secondary" @click="model.select(entry)">{{ entry.title }}</button></div></div>
      <fieldset class="cf-blueprint-links"><legend>Related entities</legend><p>Link to actions, actors, touchpoints, systems or improvements in this blueprint.</p>
        <label class="cf-field"><span>Find related entities</span><input v-model="editor.relatedFilter" type="search" placeholder="Title or entity type" /></label>
        <div v-if="model.related.length" class="cf-blueprint-link-options"><label v-for="entry in model.related" :key="entry.id"><input v-model="editor.draft.links" type="checkbox" :value="entry.id" /><span>{{ entry.title }} <small>{{ model.labels[entry.kind] }}</small></span></label></div>
        <p v-else class="cf-settings-help">{{ model.session.relatedFilter ? 'No matching entities. Change the search to find a related entity.' : 'Save this blueprint, then create entities to link them together.' }}</p>
      </fieldset>
      <div class="cf-blueprint-actions"><button type="submit" class="cf-btn cf-btn-primary">{{ model.store.busy ? 'Saving…' : 'Save entity' }}</button><button v-if="editor.draft.id" type="button" class="cf-btn cf-btn-secondary" @click="model.open(editor.draft.id)">Open entity note</button><button v-if="!model.dirty" type="button" class="cf-btn cf-btn-ghost" @click="model.close()">Close editor</button></div>
    </fieldset>
  </form>
</template>
