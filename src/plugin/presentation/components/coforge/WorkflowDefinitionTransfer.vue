<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
const model = useWorkflowEditorForm();
</script>
<template>
  <section
    v-if="model.transfer.mode"
    class="cf-workflow-transfer"
    :aria-label="
      model.transfer.mode === 'import'
        ? 'Workflow JSON import'
        : 'Workflow JSON export'
    "
  >
    <div class="cf-workflow-step-heading">
      <h2>
        {{
          model.transfer.mode === "import"
            ? "Import a workflow"
            : "Review workflow export"
        }}
      </h2>
      <button
        type="button"
        class="cf-btn cf-btn-ghost"
        @click="model.transfer.close()"
      >
        Close JSON panel
      </button>
    </div>
    <p class="cf-settings-help">
      Template selections reference this project's Markdown files, which are
      managed separately and are not included in workflow JSON. After importing
      into another project, recreate or reassign those templates before starting
      a run.
    </p>
    <template v-if="model.transfer.mode === 'import'"
      ><p>
        Import replaces only this editor’s draft after you review it. It does
        not save settings or run any step.
      </p>
      <label class="cf-field"
        ><span>Workflow JSON file</span
        ><input
          type="file"
          accept=".json,application/json"
          @change="model.transfer.readFile" /></label
      ><label class="cf-field"
        ><span>Or paste workflow JSON</span
        ><textarea
          v-model="model.transfer.text"
          rows="6"
          maxlength="400000"
          spellcheck="false"
        /></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.transfer.inspect()"
      >
        Preview import
      </button>
      <section
        v-if="model.transfer.preview"
        class="cf-workflow-import-preview"
        aria-label="Workflow import preview"
      >
        <h3>{{ model.transfer.preview.name }}</h3>
        <p>
          {{ model.transfer.preview.steps.length }} ordered steps. Existing
          unsaved edits will be replaced.
        </p>
        <pre
          class="cf-workflow-json"
          tabindex="0"
          aria-label="Imported workflow definition"
          >{{ model.transfer.previewJson }}</pre>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          @click="model.transfer.replace()"
        >
          Replace draft
        </button>
      </section></template
    >
    <template v-else
      ><p>
        This captured export snapshot includes every step’s instructions, AI
        choices, access and limits. Connection settings, workspace path fields,
        runtime data and request history are omitted. Instructions are exported
        verbatim and may contain private details; review them before sharing.
      </p>
      <pre
        class="cf-workflow-json"
        tabindex="0"
        aria-label="Workflow export JSON"
        >{{ model.transfer.exportJson }}</pre>
      <p class="cf-settings-help">
        The preview is frozen when this panel opens. Reopen it to include later
        draft edits. The general project prompt stays in Project settings.
      </p>
      <label v-if="model.transfer.exportPath" class="cf-field"
        ><span>Saved workflow JSON path</span
        ><input
          :value="model.transfer.exportPath"
          readonly
          spellcheck="false"
          class="cf-mono"
      /></label>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.transfer.copyJson()"
      >
        Copy workflow JSON
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.transfer.saving"
        @click="model.transfer.saveExport()"
      >
        {{ model.transfer.saving ? "Exporting…" : "Export workflow JSON" }}
      </button></template
    >
  </section>
</template>
