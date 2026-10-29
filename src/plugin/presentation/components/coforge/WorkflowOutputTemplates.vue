<script setup lang="ts">
import { useWorkflowOutputTemplates } from "../../composables/coforge/use-workflow-output-templates";
import MarkdownBody from "./MarkdownBody.vue";
import WorkflowTemplateUsage from "./WorkflowTemplateUsage.vue";
const props = defineProps<{ projectId: string }>();
const emit = defineEmits<{ changed: [] }>();
const model = useWorkflowOutputTemplates(
  () => props.projectId,
  () => emit("changed"),
);
</script>
<template>
  <details
    :ref="model.bindLibrary"
    class="cf-workflow-template-library"
    aria-label="Project answer and output templates"
  >
    <summary>
      Answer / output templates <span>{{ model.editor.templates.length }}</span>
    </summary>
    <p class="cf-settings-help">
      Reusable Markdown files for this project's AI answers. Save a template
      here, then select it on a step. Template saves are independent of workflow
      saves.
    </p>
    <p v-if="!model.available" class="cf-settings-help">
      Open this workflow in Obsidian to create and manage template files.
    </p>
    <template v-else>
      <div class="cf-workflow-template-toolbar">
        <label class="cf-field"
          ><span>Template library</span
          ><select
            :value="model.editor.selectedId"
            aria-label="Template library"
            :disabled="model.busy || model.dirty"
            @change="model.choose($event)"
          >
            <option value="">Choose a saved template</option>
            <option
              v-for="template in model.editor.templates"
              :key="template.id"
              :value="template.id"
            >
              {{ template.name }}
            </option>
          </select></label
        >
        <button
          :ref="model.bindNew"
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.busy || model.dirty"
          @click="model.create()"
        >
          New template
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="model.busy"
          @click="model.refresh()"
        >
          Refresh templates
        </button>
      </div>
      <p v-if="model.editor.error" class="cf-inline-error" role="alert">
        {{ model.editor.error }}
      </p>
      <p
        v-if="model.editor.notice"
        role="status"
        class="cf-workflow-editor-notice"
      >
        {{ model.editor.notice }}
      </p>
      <p v-if="model.editor.loading" role="status">Loading templates…</p>
      <p
        v-if="model.editor.invalid.length"
        class="cf-inline-error"
        role="alert"
      >
        {{ model.editor.invalid.length }} template file(s) need repair. They
        cannot be selected. Open the Markdown files in the vault, correct their
        metadata, then refresh.
      </p>
      <ul
        v-if="model.editor.invalid.length"
        class="cf-workflow-template-invalid"
      >
        <li v-for="entry in model.editor.invalid" :key="entry.path">
          <code>{{ entry.path }}</code> · {{ entry.reason }}
        </li>
      </ul>
      <p
        v-if="
          !model.editor.templates.length &&
          !model.editor.draft &&
          !model.editor.loading
        "
        class="cf-settings-help"
      >
        No templates yet. Create a report outline, review checklist or response
        structure for your steps.
      </p>
      <form v-if="model.editor.draft" @submit.prevent="model.save()">
        <fieldset :disabled="model.busy">
          <legend class="cf-sr-only">Edit output template</legend>
          <label class="cf-field"
            ><span>Template name</span
            ><input
              :ref="model.bindName"
              v-model="model.editor.draft.name"
              aria-label="Template name"
              maxlength="100"
              required
          /></label>
          <label class="cf-field"
            ><span>Template Markdown</span
            ><textarea
              :ref="model.bindMarkdown"
              v-model="model.editor.draft.markdown"
              aria-label="Template Markdown"
              rows="9"
              maxlength="8000"
              required
              spellcheck="false"
              placeholder="# Summary&#10;&#10;## Findings&#10;&#10;## Next steps"
            /><small
              >Write the headings and guidance the answer should follow.
              Markdown is used as written, without placeholder
              substitution.</small
            ></label
          >
          <details
            v-if="model.editor.draft.markdown"
            class="cf-workflow-template-preview"
          >
            <summary>Preview template</summary>
            <MarkdownBody :source="model.editor.draft.markdown" />
          </details>
          <div class="cf-settings-actions">
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              @click="model.copyDraft()"
            >
              Copy template draft Markdown
            </button>
            <button
              type="submit"
              class="cf-btn cf-btn-primary"
              :disabled="!model.canSave"
            >
              {{ model.editor.working ? "Saving template…" : "Save template" }}
            </button>
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="!model.dirty"
              @click="model.discard()"
            >
              Discard template changes
            </button>
            <button
              v-if="model.selected"
              type="button"
              class="cf-btn cf-btn-ghost"
              @click="model.open()"
            >
              Open Markdown note
            </button>
            <button
              v-if="model.selected"
              :ref="model.bindDelete"
              type="button"
              class="cf-btn cf-btn-ghost"
              :disabled="model.dirty"
              @click="model.requestDelete()"
            >
              Delete template
            </button>
          </div>
          <section
            v-if="model.sourceChanged && model.selected"
            aria-label="Template conflict recovery"
          >
            <h3>The saved template changed</h3>
            <p class="cf-settings-help">
              Copy your draft Markdown first. Discard template changes to load
              the latest saved version, then reapply the parts you want to keep.
              Refresh preserves your draft and never overwrites someone else's
              edits.
            </p>
            <details>
              <summary>Latest saved template</summary>
              <p>{{ model.selected.name }}</p>
              <pre
                class="cf-workflow-json"
                tabindex="0"
                aria-label="Latest saved template Markdown"
                >{{ model.selected.markdown }}</pre>
            </details>
          </section>
          <p v-if="model.dirty" class="cf-settings-help">
            Unsaved template changes are kept while you navigate. Save or
            discard them before choosing another template.
          </p>
        </fieldset>
      </form>
      <WorkflowTemplateUsage
        v-if="model.selected"
        :project-id="projectId"
        :template-id="model.selected.id"
        :revision="model.selected.revision"
      />
      <section
        v-if="model.editor.deleting && model.selected"
        class="cf-workflow-template-delete"
        aria-label="Confirm template deletion"
      >
        <h3>Delete “{{ model.selected.name }}”?</h3>
        <p>
          Obsidian uses your file deletion preference. Existing runs keep their
          captured content. Steps using this template will need another
          selection before a new run.
        </p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.busy"
            @click="model.remove()"
          >
            Delete template file</button
          ><button
            :ref="model.bindKeep"
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.busy"
            @click="model.cancelDelete()"
          >
            Keep template
          </button>
        </div>
      </section>
    </template>
  </details>
</template>
