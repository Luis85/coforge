<script setup lang="ts">
import type { CouncilFolderActions } from "../../../features/coforge/application/council-catalogue";
import type { CouncilDefinitionFolders } from "../../../features/coforge/domain/council-definition-folders";
import { useCouncilFolderEditor } from "../../composables/coforge/use-council-folder-editor";
const props = defineProps<{
  actions: CouncilFolderActions;
  folders: CouncilDefinitionFolders;
  preferencesRevision: number;
}>();
const model = useCouncilFolderEditor(props);
</script>
<template>
  <details class="cf-council-section">
    <summary>Definition folders</summary>
    <p class="cf-settings-help">
      Choose private vault folders for new agents, teams and councils. Preview
      validates protected scopes and current definitions. Saving never moves or
      deletes human files.
    </p>
    <p v-if="model.store.error" role="alert" class="cf-inline-error">
      {{ model.store.error }}
    </p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    <form @submit.prevent="model.save()">
      <fieldset :disabled="model.store.busy">
        <legend class="cf-sr-only">
          Configure canonical definition folders
        </legend>
        <label v-for="field in model.fields" :key="field.key" class="cf-field"
          ><span>{{ field.label }}</span
          ><input
            v-model="model.store.draft[field.key]"
            :aria-label="field.label"
            maxlength="200"
            required
        /></label>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.preview()"
          >
            Preview definition folders</button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            @click="model.reset()"
          >
            Reset folder draft
          </button>
        </div>
        <section
          v-if="model.store.preview"
          aria-label="Definition folder preview"
        >
          <h3>Folder scope preview</h3>
          <p>
            {{ model.store.preview.definitionCount }} current definitions
            resolved by stable identity. Existing private definitions remain at
            their current paths.
          </p>
          <ul>
            <li v-for="field in model.fields" :key="field.key">
              {{ field.label }}:
              <code>{{ model.store.preview.folders[field.key] }}</code>
            </li>
          </ul>
          <ul v-if="model.store.preview.invalid.length">
            <li
              v-for="invalid in model.store.preview.invalid"
              :key="invalid.path"
            >
              <code>{{ invalid.path }}</code
              >: {{ invalid.reason }}
            </li>
          </ul>
          <button
            type="submit"
            class="cf-btn cf-btn-primary"
            :disabled="!!model.store.preview.invalid.length"
          >
            Save definition folders
          </button>
        </section>
      </fieldset>
    </form>
  </details>
</template>
