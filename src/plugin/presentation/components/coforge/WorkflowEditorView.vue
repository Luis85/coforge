<script setup lang="ts">
import { useWorkflowEditor } from "../../composables/coforge/use-workflow-editor";
import { useEventTriggerLink } from "../../composables/coforge/use-event-trigger-link";
import WorkflowStepList from "./WorkflowStepList.vue";
import WorkflowStepEditor from "./WorkflowStepEditor.vue";
import WorkflowDefinitionLimits from "./WorkflowDefinitionLimits.vue";
import WorkflowDefinitionTransfer from "./WorkflowDefinitionTransfer.vue";
import WorkflowOutputTemplates from "./WorkflowOutputTemplates.vue";
import WorkflowValidationSummary from "./WorkflowValidationSummary.vue";
withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const model = useWorkflowEditor();
const openEventTriggers = useEventTriggerLink();
</script>
<template>
  <div class="cf-workflow-settings-page" :class="{ 'is-embedded': embedded }">
    <header
      class="cf-page-heading"
      :class="{ 'cf-workflow-subpage-heading': embedded }"
    >
      <div>
        <component :is="embedded ? 'h2' : 'h1'">Workflow settings</component>
        <p>
          Design the ordered AI and human steps for
          {{ model.project?.settings.projectName || "this project" }}. Saving
          prepares future runs; it never starts an agent.
        </p>
      </div>
    </header>
    <details v-if="model.store.featureEnabled('council')" class="cf-workflow-related">
      <summary>Request workflows and Council proposal processes</summary>
      <p>
        Use this workflow to move an existing request through ordered AI and
        human steps. For a separate process involving reusable CoWorkers and
        councils, open
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.store.navigate('council')"
        >
          The Council</button
        >.
      </p>
    </details>
    <section
      v-if="!model.project || model.project.unavailable"
      class="cf-empty-state"
      aria-label="Choose a project for workflow settings"
    >
      <h2>Choose a project</h2>
      <p>Select an available project before configuring its workflow.</p>
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        @click="model.store.navigate('projects')"
      >
        Manage projects
      </button>
    </section>
    <form v-else class="cf-workflow-editor" @submit.prevent="model.save()">
      <fieldset :disabled="model.saving">
        <legend class="cf-sr-only">Project workflow configuration</legend>
        <div class="cf-workflow-editor-toolbar">
          <div>
            <code>{{ model.project.id }}</code
            ><span>{{
              model.dirty
                ? "Unsaved changes"
                : model.hasSavedDefinition
                  ? "Saved definition"
                  : "Standard defaults"
            }}</span>
          </div>
          <details class="cf-workflow-tools">
            <summary>Workflow tools</summary>
            <div class="cf-settings-actions">
              <button
                type="button"
                class="cf-btn cf-btn-secondary"
                @click="model.transfer.openImport()"
              >
                Import JSON</button
              ><button
                type="button"
                class="cf-btn cf-btn-secondary"
                @click="model.transfer.openExport()"
              >
                Preview workflow export
              </button>
              <button
                v-if="model.store.featureEnabled('council')"
                type="button"
                class="cf-btn cf-btn-secondary"
                @click="openEventTriggers()"
              >
                Attach an event trigger
              </button>
            </div>
          </details>
        </div>
        <label class="cf-field"
          ><span>Workflow name</span
          ><input
            v-model="model.draft.name"
            data-workflow-field="name"
            maxlength="100"
            required
        /></label>
        <p class="cf-workflow-policy">
          {{ model.draft.steps.length }} ordered steps ·
          {{ model.aiStepCount }} AI · {{ model.humanStepCount }} human
          checkpoints<template v-if="model.nudgeStepCount">
            · {{ model.nudgeStepCount }} agent
            {{ model.nudgeStepCount === 1 ? "nudge" : "nudges" }}</template
          >. Select a step to define its task and answer. Changes apply to new
          runs after saving; code changes still need final review.
        </p>
        <p v-if="model.error" class="cf-inline-error" role="alert">
          {{ model.error }}
        </p>
        <p v-if="model.notice" class="cf-workflow-editor-notice" role="status">
          {{ model.notice }}
        </p>
        <WorkflowDefinitionTransfer />
        <WorkflowValidationSummary />
        <div class="cf-workflow-editor-layout">
          <WorkflowStepList /><WorkflowStepEditor />
        </div>
        <WorkflowDefinitionLimits />
        <div class="cf-workflow-editor-save">
          <div>
            <p
              v-if="model.blocked || model.validation"
              class="cf-settings-help"
              aria-live="polite"
            >
              {{ model.blocked || model.validation }}
            </p>
            <p v-else class="cf-settings-help">
              Existing runs retain their captured definition. New runs use your
              saved steps.
            </p>
          </div>
          <div class="cf-settings-actions">
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.dirty || model.saving"
              @click="model.discard()"
            >
              Discard workflow changes</button
            ><button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="!model.canSave"
            >
              {{
                model.saving
                  ? "Saving workflow…"
                  : !model.hasSavedDefinition && !model.dirty
                    ? "Use standard workflow"
                    : "Save workflow"
              }}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
    <WorkflowOutputTemplates
      v-if="model.project && !model.project.unavailable"
      :project-id="model.project.id"
    />
  </div>
</template>
