<script setup lang="ts">
import { useSettings } from "../../composables/coforge/use-settings";
import CfIcon from "./CfIcon.vue";
import SettingsDataSection from "./SettingsDataSection.vue";
import SettingsRuntimeSection from "./SettingsRuntimeSection.vue";
import SettingsRepositorySection from "./SettingsRepositorySection.vue";
import ProjectWorkContext from "./ProjectWorkContext.vue";
import SettingsRequestObjectSection from './SettingsRequestObjectSection.vue';

const model = useSettings();
</script>
<template>
  <div class="cf-settings-page">
    <header class="cf-page-heading">
      <div>
        <h1>Project settings</h1>
        <p>
          Configure {{ model.draft.projectName }}. Each project keeps its own
          brief, workspace and workflow.
        </p>
      </div>
      <span class="cf-settings-local-label"
        ><CfIcon name="shield-check" size="sm" /> Local workspace</span
      >
    </header>
    <ProjectWorkContext />
    <section
      v-if="!model.availableProject && !model.dirty"
      class="cf-empty-state"
      aria-label="Choose a project for settings"
    >
      <h2>Choose a project</h2>
      <p>
        Add or select an available project before configuring its workspace and
        workflow steps.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        @click="model.store.navigate('projects')"
      >
        Manage projects
      </button>
    </section>
    <form v-else class="cf-settings-form" @submit="model.submit">
      <fieldset class="cf-project-config-fields" :disabled="model.saving">
        <legend class="cf-sr-only">Project configuration</legend>
        <div v-if="model.error" class="cf-settings-alert is-error" role="alert">
          <CfIcon name="circle-alert" />
          <span>{{ model.error }}</span>
        </div>
        <section class="cf-settings-section" aria-labelledby="cf-settings-game">
          <div class="cf-settings-description">
            <h2 id="cf-settings-game">
              <CfIcon name="folder-git-2" /> The game
            </h2>
            <p>
              The brief gives the scoring and planning agents a shared
              direction.
            </p>
          </div>
          <div class="cf-settings-fields">
            <label class="cf-field"><span>Project visibility</span><select v-model="model.draft.visibility" aria-label="Project visibility" :aria-describedby="`${model.store.layoutId}-project-visibility-help`"><option value="public">Public · eligible for viewer discovery</option><option value="private">Private · owner workspace only</option></select><small :id="`${model.store.layoutId}-project-visibility-help`">Private projects are excluded from public discovery, requests and recognition. Existing Twitch text cannot be recalled. Republish your GitHub Pages site after removing prior local exports.</small></label>
            <p v-if="model.store.activeProject?.visibility !== 'private' && model.store.state?.runtime.publicationDeniedProjectIds?.includes(model.editingProjectId)" class="cf-inline-error" role="status">Publication is blocked for this project. Save an explicit public visibility choice to restore it, or repair storage and reconcile the private project note. Previously deployed pages require republishing.</p>
            <label class="cf-field">
              <span>Project name</span>
              <input
                v-model="model.draft.projectName"
                type="text"
                maxlength="80"
                required
                placeholder="Mosslight"
              />
            </label>
            <label class="cf-field">
              <span>Description</span>
              <textarea
                v-model="model.draft.projectBrief"
                minlength="10"
                maxlength="8000"
                rows="5"
                required
                placeholder="Describe the game, its audience, mechanics, and what you are building next."
                aria-describedby="cf-settings-brief-help"
              />
              <small id="cf-settings-brief-help"
                >Include design goals, scope boundaries, and the kind of
                experience you want to build.</small
              >
            </label>
            <label class="cf-field"
              ><span>General agent prompt</span
              ><textarea
                v-model="model.draft.agentPrompt"
                aria-label="General agent prompt"
                maxlength="8000"
                rows="5"
                aria-describedby="cf-settings-agent-prompt-help"
                placeholder="Project conventions and instructions for every agent dispatch"
              /><small id="cf-settings-agent-prompt-help"
                >Prefixed to every dispatch for this project. Agent tool
                restrictions and worktree boundaries still apply.</small
              ></label
            >
          </div>
        </section>
        <SettingsRequestObjectSection />
        <SettingsRepositorySection />
        <p class="cf-settings-help">
          Viewer feature requests have a fixed 5-minute cooldown across all
          projects. Review registration and participation under Viewers;
          configure currency income, command prices and rewards under Economy,
          and XP, reputation and ranks under Community settings.
        </p>
        <section
          class="cf-settings-workflow-link"
          aria-label="Workflow configuration location"
        >
          <h2>Configure the workflow separately</h2>
          <p>
            Steps, AI providers, models, prompts and run limits live in Workflow
            settings for this project.
          </p>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.store.navigate('workflow-settings')"
          >
            Open Workflow settings
          </button>
        </section>
        <div class="cf-settings-save">
          <span class="cf-settings-help" aria-live="polite">
            <template v-if="model.status === 'saved'"
              ><CfIcon name="circle-check" size="sm" /> Settings saved</template
            >
            <template v-else-if="model.status === 'dirty'"
              >You have unsaved changes.</template
            >
            <template v-else>All changes saved in this vault.</template>
          </span>
          <div class="cf-settings-actions">
            <button
              class="cf-btn cf-btn-secondary"
              type="button"
              :disabled="model.store.busy || !model.dirty"
              @click="model.discard()"
            >
              Discard changes
            </button>
            <button
              class="cf-btn cf-btn-primary"
              type="submit"
              :disabled="model.store.busy || (model.pending && !model.visibilityOnlyDirty) || !model.dirty"
            >
              <CfIcon name="save" size="sm" />
              {{ model.saving ? "Saving settings…" : "Save settings" }}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
    <SettingsRuntimeSection v-if="model.availableProject" />
    <SettingsDataSection v-if="model.store.state" />
  </div>
</template>
