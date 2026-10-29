<script setup lang="ts">
import { useCouncilEditorForm } from '../../composables/coforge/use-council-definitions';
import CouncilDefinitionFields from './CouncilDefinitionFields.vue';
import CouncilDefinitionDependencies from './CouncilDefinitionDependencies.vue';
defineProps<{ coworker?: boolean }>();
const model = useCouncilEditorForm();
</script>
<template>
      <form v-if="model.store.draft" @submit.prevent="model.save()">
        <fieldset :disabled="model.store.busy">
          <legend class="cf-sr-only">Edit selected definition</legend>
          <p role="status">
            {{
              model.dirty
                ? "Unsaved changes · draft preserved when you switch definitions or projects."
                : "Saved definition"
            }}
          </p>
          <CouncilDefinitionFields />
          <CouncilDefinitionDependencies
            :catalogue="model.catalogueActions"
            :definition-id="model.store.draft.id"
          />
          <div class="cf-settings-actions">
            <button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="
                model.store.draft.schema === 'agent/v1' &&
                model.store.draft.enabled &&
                !!model.profileIssue
              "
            >
              {{ model.store.busy ? 'Saving…' : coworker ? 'Save CoWorker' : 'Save definition' }}</button
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.store.revision"
              @click="model.open()"
            >
              Open note</button
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :disabled="!model.store.revision"
              @click="model.duplicate()"
            >
              {{ coworker ? 'Duplicate CoWorker' : 'Duplicate definition' }}</button
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :disabled="
                !model.store.revision ||
                !model.store.draft.enabled ||
                model.dirty
              "
              @click="model.archive()"
            >
              {{ coworker ? 'Archive CoWorker' : 'Archive definition' }}
            </button>
            <button
              v-if="model.dirty"
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.discard()"
            >
              Discard draft
            </button>
          </div>
          <p v-if="model.dirty" class="cf-settings-help">
            Duplicate uses the saved definition and keeps your current draft.
            Save or discard changes before archiving.
          </p>
        </fieldset>
      </form>
</template>

