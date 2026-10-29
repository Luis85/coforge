<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useRequestValuesEditor } from '../../composables/coforge/use-request-values-editor';
import RequestObjectFields from './RequestObjectFields.vue';
const props = defineProps<{ idea: Idea }>();
const model = useRequestValuesEditor(props);
</script>
<template>
  <section v-if="idea.requestObject" class="cf-idea-section" aria-label="Captured request object">
    <form class="cf-request-values-editor" @submit.prevent="model.save()">
      <header><h3>{{ idea.requestObject.className || 'Project request fields' }}</h3><p>Captured when this request was created. Later project definitions do not reinterpret these fields.</p></header>
      <RequestObjectFields :fields="idea.requestObject.fields" :values="model.draft.values" :disabled="model.draft.working || model.closed" @change="model.update($event)" />
      <p v-if="model.closed">Closed requests keep their recorded field values.</p>
      <p v-else>Changing values requires fresh screening. Unrelated note properties and body text stay intact.</p>
      <p v-if="model.stale" class="cf-inline-error">This request changed outside your draft. Discard changes to review the latest values before saving.</p>
      <p v-if="model.draft.error" class="cf-inline-error" role="alert">{{ model.draft.error }}</p><p v-if="model.draft.notice" role="status">{{ model.draft.notice }}</p>
      <div v-if="idea.requestObject.fields.length" class="cf-settings-actions"><button type="submit" class="cf-btn cf-btn-primary" :disabled="!model.dirty || model.stale || model.closed || model.draft.working || model.busy">Save request fields</button><button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.dirty || model.draft.working" @click="model.discard()">Discard field changes</button></div>
    </form>
  </section>
</template>
