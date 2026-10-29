<script setup lang="ts">
import type { CouncilCatalogueActions } from "../../../features/coforge/application/council-catalogue";
import { useCouncilDefinitions } from "../../composables/coforge/use-council-definitions";
import CouncilSetupReadiness from "./CouncilSetupReadiness.vue";
import CouncilDefinitionEditor from "./CouncilDefinitionEditor.vue";

const props = defineProps<{
  catalogue: CouncilCatalogueActions;
  projectId: string;
  teamsOnly?: boolean;
}>();
const model = useCouncilDefinitions(props);
</script>
<template>
  <section
    class="cf-council-definitions"
    :aria-label="teamsOnly ? 'Team and Council definitions' : 'CoWorker, team and council definitions'"
  >
    <header class="cf-page-heading">
      <div>
        <h2>{{ teamsOnly ? 'Councils & roster' : 'CoWorkers, teams and councils' }}</h2>
        <p>
          Reuse specialist instructions and configure ordered discussions.
          Definitions are private Markdown notes.
        </p>
      </div>
    </header>
    <p v-if="model.store.error" role="alert" class="cf-inline-error">
      {{ model.store.error }}
    </p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    <CouncilSetupReadiness v-if="teamsOnly" />
    <div class="cf-settings-actions">
      <button
        v-if="!teamsOnly"
        type="button"
        class="cf-btn cf-btn-primary"
        :disabled="model.store.busy || !model.store.catalogueLoaded"
        @click="model.createAgent()"
      >
        Create CoWorker</button
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || !projectId || !model.store.catalogueLoaded"
        @click="model.createTeam()"
      >
        Create team</button
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || !model.store.catalogueLoaded || !model.readiness.usableTeams.length"
        @click="model.createCouncil()"
      >
        Create council</button
      ><button
        type="button"
        class="cf-btn cf-btn-ghost"
        :disabled="model.store.busy"
        @click="model.load()"
      >
        Refresh definitions
      </button>
    </div>
    <div v-if="model.catalogue.invalid.length" role="status">
      <h3>Definitions need repair</h3>
      <ul>
        <li v-for="invalid in model.catalogue.invalid" :key="invalid.path">
          <code>{{ invalid.path }}</code
          >: {{ invalid.reason }}
        </li>
      </ul>
    </div>
    <div class="cf-council-editor-layout">
      <nav aria-label="Saved definitions">
        <label class="cf-field"
          ><span>Search definitions</span
          ><input v-model="model.store.search" type="search" maxlength="100"
        /></label>
        <p v-if="model.store.catalogueLoading" class="cf-settings-help" role="status">Loading saved definitions…</p>
        <p v-else-if="!model.store.catalogueLoaded" class="cf-settings-help">Saved definitions are unavailable. Refresh definitions to retry; your authored drafts are kept.</p>
        <p v-else-if="!model.entries.length" class="cf-settings-help">
          {{
            model.store.search
              ? "No matching definitions. Clear the search to see the catalogue."
              : "No definitions yet. Start by creating a specialist CoWorker."
          }}
        </p>
        <ul class="cf-council-definition-list">
          <li v-for="entry in model.entries" :key="entry.definition.id">
            <button
              type="button"
              class="cf-btn cf-btn-ghost"
              :aria-current="
                model.store.draft?.id === entry.definition.id
                  ? 'true'
                  : undefined
              "
              @click="model.select(entry)"
            >
              <span>{{ entry.definition.name }}</span
              ><small
                >{{ entry.definition.schema.split("/")[0] }} ·
                {{ entry.definition.enabled ? "Available" : "Disabled" }}</small
              >
              <small v-if="model.changed(entry.definition.id)"
                >Unsaved draft</small
              >
            </button>
          </li>
        </ul>
        <section
          v-if="model.unsaved.length"
          aria-label="Unsaved definition drafts"
        >
          <h3>Unsaved drafts</h3>
          <ul class="cf-council-draft-list">
            <li v-for="draft in model.unsaved" :key="draft.definition.id">
              <button
                type="button"
                class="cf-btn cf-btn-ghost"
                @click="model.restoreDraft(draft.definition.id)"
              >
                {{ draft.definition.name }} · Draft
              </button>
            </li>
          </ul>
        </section>
      </nav>
      <CouncilDefinitionEditor v-if="model.store.draft" />
      <p v-else class="cf-settings-help">
        Select a definition to edit its instructions, membership and protocol.
        Existing runs keep their captured revisions.
      </p>
    </div>
    <details>
      <summary>Import and export definitions</summary>
      <p class="cf-settings-help">
        Preview replacement before saving. Imports stay disabled until local
        permissions and connection profiles are reviewed. Exports contain
        authored instructions; review them before sharing.
      </p>
      <label class="cf-field"
        ><span>Definition JSON to import</span
        ><textarea
          v-model="model.store.importJson"
          rows="6"
          spellcheck="false"
        /></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || !model.store.importJson"
        @click="model.previewImport()"
      >
        Preview import
      </button>
      <section
        v-if="model.store.preview"
        aria-label="Import replacement preview"
      >
        <p>{{ model.store.preview.summary }}</p>
        <div class="cf-council-fields">
          <div>
            <h4>Current definition</h4>
            <pre>{{
              model.store.preview.previous
                ? JSON.stringify(model.store.preview.previous, null, 2)
                : "New definition"
            }}</pre>
          </div>
          <div>
            <h4>Imported definition</h4>
            <pre>{{
              JSON.stringify(model.store.preview.definition, null, 2)
            }}</pre>
          </div>
        </div>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="model.store.busy"
          @click="model.applyImport()"
        >
          Save imported definition
        </button>
      </section>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || !model.store.revision"
        @click="model.exportDefinition()"
      >
        Preview definition export</button
      ><label v-if="model.store.exportJson" class="cf-field"
        ><span>Portable definition JSON</span
        ><textarea
          :value="model.store.exportJson"
          rows="8"
          readonly
          spellcheck="false"
        />
      </label>
    </details>
  </section>
</template>
