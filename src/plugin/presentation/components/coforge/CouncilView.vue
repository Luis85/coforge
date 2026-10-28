<script setup lang="ts">
import { useCouncil } from "../../composables/coforge/use-council";
import CouncilDefinitions from "./CouncilDefinitions.vue";
import CouncilSubmission from "./CouncilSubmission.vue";
import CouncilMonitor from "./CouncilMonitor.vue";
import WorkflowV2Editor from "./WorkflowV2Editor.vue";
import CouncilMessages from "./CouncilMessages.vue";
import CouncilFolderSettings from "./CouncilFolderSettings.vue";
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
      <div class="cf-settings-actions" aria-label="Council execution controls">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy"
          @click="model.checkRuntime()"
        >
          Check native runtime
        </button>
        <span role="status">{{
          model.store.state?.paused ? "Execution paused" : "Execution resumed"
        }}</span>
        <button
          v-if="!model.store.state?.executor"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy || !model.store.state?.ready"
          @click="model.designate()"
        >
          Use this desktop for execution
        </button>
        <template v-else
          ><button
            v-if="model.store.state.paused"
            type="button"
            class="cf-btn cf-btn-primary"
            :disabled="model.store.busy"
            @click="model.resume()"
          >
            Resume Council execution</button
          ><button
            v-else
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.pause()"
          >
            Pause before next action
          </button></template
        >
      </div>
      <button
        v-if="model.store.state?.executor && model.projectId"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.pauseProject()"
      >
        {{
          model.store.state.preferences.pausedProjectIds?.includes(
            model.projectId,
          )
            ? "Resume selected project"
            : "Pause selected project"
        }}
      </button>
      <nav class="cf-settings-actions" aria-label="Council workspace">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-current="model.store.tab === 'definitions' ? 'page' : undefined"
          @click="model.store.tab = 'definitions'"
        >
          Definitions
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-current="model.store.tab === 'submit' ? 'page' : undefined"
          @click="
            model.store.tab = 'submit';
            model.refresh();
          "
        >
          Submit and preflight
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-current="model.store.tab === 'inboxes' ? 'page' : undefined"
          @click="
            model.store.tab = 'inboxes';
            model.refresh();
          "
        >
          Watched inboxes
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-current="model.store.tab === 'monitor' ? 'page' : undefined"
          @click="model.store.tab = 'monitor'"
        >
          Run monitor
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-current="model.store.tab === 'workflows' ? 'page' : undefined"
          @click="
            model.store.tab = 'workflows';
            model.refresh();
          "
        >
          Council workflows
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-current="model.store.tab === 'messages' ? 'page' : undefined"
          @click="
            model.store.tab = 'messages';
            model.refresh();
          "
        >
          Team messages
        </button>
      </nav>
      <template v-if="model.store.tab === 'definitions'">
        <CouncilDefinitions
          :catalogue="model.service.catalogue"
          :project-id="model.projectId"
        />
        <CouncilFolderSettings
          v-if="model.store.state"
          :actions="model.service.definitionFolders"
          :folders="
            model.store.state.preferences.definitionFolders ??
            DEFAULT_COUNCIL_FOLDERS
          "
          :preferences-revision="model.store.state.preferences.revision"
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
      <CouncilMonitor v-else />
    </template>
  </div>
</template>
