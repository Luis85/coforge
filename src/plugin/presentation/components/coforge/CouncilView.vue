<script setup lang="ts">
import { useCouncil } from "../../composables/coforge/use-council";
import CfSubpageNav from "./CfSubpageNav.vue";
import CouncilExecutionControls from "./CouncilExecutionControls.vue";
import CouncilDefinitions from "./CouncilDefinitions.vue";
import CouncilSubmission from "./CouncilSubmission.vue";
import CouncilMonitor from "./CouncilMonitor.vue";
import WorkflowV2Editor from "./WorkflowV2Editor.vue";
import CouncilMessages from "./CouncilMessages.vue";
import CouncilFolderSettings from "./CouncilFolderSettings.vue";
import ProjectWorkContext from "./ProjectWorkContext.vue";
import { DEFAULT_COUNCIL_FOLDERS } from "../../../features/coforge/domain/council-definition-folders";
const model = useCouncil();
</script>
<template>
  <div class="cf-council">
    <header class="cf-page-heading">
      <div>
        <h1>The Council</h1>
        <p>
          Reusable specialists, independent opinions and attributable solutions
          in your notes.
        </p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.refresh()"
      >
        Refresh Council
      </button>
    </header>
    <ProjectWorkContext />
    <p v-if="!model.service">
      Open this view in desktop Obsidian to create vault-backed definitions and
      submit private Markdown notes.
    </p>
    <button
      v-if="!model.service && model.canPreview"
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="model.explore()"
    >
      Explore Council example
    </button>
    <p v-if="model.example" role="status">
      Council example · in-memory definitions and simulated outputs only.
      Nothing is saved to your vault.
    </p>
    <button
      v-if="model.example"
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.store.busy"
      title="Discard temporary definitions, runs and example drafts"
      @click="model.exitExample()"
    >
      Exit example
    </button>
    <template v-if="model.service">
      <p v-if="!model.projectId">
        Create or select a project before configuring teams, councils and
        proposal workflows.
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.studio.navigate('projects')"
        >
          Manage projects
        </button>
      </p>
      <p
        v-if="model.store.error || model.store.state?.error"
        role="alert"
        class="cf-inline-error"
      >
        {{ model.store.error || model.store.state?.error }}
      </p>
      <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
      <CfSubpageNav
        label="Council workspace"
        :items="model.pages"
        :selected="model.store.tab"
        @select="model.selectPage($event)"
      />
      <section
        v-if="
          model.store.state &&
          !model.store.state.executor &&
          model.store.tab !== 'monitor'
        "
        class="cf-intent-empty"
        aria-label="Council execution prerequisite"
      >
        <p>
          Before submitting work or changing inboxes and definition folders,
          open Run monitor and designate this desktop for execution. Execution
          stays paused until you explicitly resume it.
        </p>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.selectPage('monitor')"
        >
          Open Run monitor
        </button>
      </section>
      <CouncilExecutionControls v-show="model.store.tab === 'monitor'" />
      <template v-if="model.store.tab === 'definitions'">
        <CouncilDefinitions
          :catalogue="model.service.catalogue"
          :project-id="model.projectId"
        />
      </template>
      <WorkflowV2Editor
        v-else-if="model.store.tab === 'workflows'"
        :actions="model.service.workflows"
        :catalogue="model.service.catalogue"
        :project-id="model.projectId"
      />
      <section
        v-else-if="model.store.tab === 'messages'"
        class="cf-council-section"
      >
        <label class="cf-field"
          ><span>Message team</span
          ><select v-model="model.store.team">
            <option value="">Select team</option>
            <option
              v-for="entry in model.teams"
              :key="entry.definition.id"
              :value="entry.definition.id"
            >
              {{ entry.definition.name }}
            </option>
          </select></label
        ><CouncilMessages
          :actions="model.service"
          :team-id="model.store.team"
        />
      </section>
      <CouncilSubmission
        v-else-if="
          model.store.tab === 'submit' || model.store.tab === 'inboxes'
        "
      />
      <CouncilMonitor v-else-if="model.store.tab === 'monitor'" />
      <CouncilFolderSettings
        open
        v-if="model.store.state"
        v-show="model.store.tab === 'folders'"
        :actions="model.service.definitionFolders"
        :folders="
          model.store.state.preferences.definitionFolders ??
          DEFAULT_COUNCIL_FOLDERS
        "
        :preferences-revision="model.store.state.preferences.revision"
      />
    </template>
  </div>
</template>
