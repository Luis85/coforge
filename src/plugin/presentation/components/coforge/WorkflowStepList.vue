<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
import {
  WORKFLOW_KIND_LABELS,
  WORKFLOW_OUTPUT_LABELS,
  WORKFLOW_PRESETS,
} from "../../stores/workflow-editor-draft";
import CfIcon from "./CfIcon.vue";
const model = useWorkflowEditorForm();
</script>
<template>
  <section
    :ref="model.bindStepList"
    class="cf-workflow-step-list"
    data-workflow-field="steps"
    tabindex="-1"
    aria-label="Workflow step order"
  >
    <div class="cf-workflow-step-list-header">
      <h2>
        Steps <span>{{ model.draft.steps.length }}/40</span>
      </h2>
      <p class="cf-settings-help">
        Run from top to bottom. Manual steps wait for your decision.
      </p>
      <p v-if="!model.draft.steps.length" class="cf-settings-help">
        Add at least one AI or manual step to save this workflow.
      </p>
    </div>
    <ol aria-label="Workflow steps">
      <li
        v-for="(step, index) in model.draft.steps"
        :key="step.id"
        :data-step-id="step.id"
        :class="{ 'is-selected': step.id === model.selectedId }"
      >
        <button
          type="button"
          class="cf-workflow-step-select"
          :aria-current="step.id === model.selectedId ? 'step' : undefined"
          @click="model.select(step.id)"
        >
          <span class="cf-workflow-step-number">{{ index + 1 }}</span
          ><span
            ><strong>{{ step.name || "Unnamed step" }}</strong
            ><small>{{
              step.kind === "ai"
                ? WORKFLOW_OUTPUT_LABELS[step.output]
                : WORKFLOW_KIND_LABELS[step.kind]
            }}</small></span
          >
        </button>
        <div class="cf-workflow-step-actions">
          <button
            type="button"
            class="cf-btn cf-btn-ghost"
            :aria-label="`Move ${step.name} up`"
            :disabled="index === 0"
            @click="model.move(step.id, -1)"
          >
            <CfIcon name="arrow-up" size="sm" /></button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :aria-label="`Move ${step.name} down`"
            :disabled="index === model.draft.steps.length - 1"
            @click="model.move(step.id, 1)"
          >
            <CfIcon name="arrow-down" size="sm" /></button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :aria-label="`Duplicate ${step.name}`"
            :disabled="model.draft.steps.length >= 40"
            @click="model.duplicate(step.id)"
          >
            <CfIcon name="copy" size="sm" /></button
          ><button
            type="button"
            class="cf-btn cf-btn-ghost"
            :aria-label="`Remove ${step.name} from workflow`"
            @click="model.remove(step.id)"
          >
            <CfIcon name="trash-2" size="sm" />
          </button>
        </div>
      </li>
    </ol>
    <div class="cf-workflow-step-list-tools">
      <details class="cf-workflow-add-step">
        <summary>Add a step</summary>
        <p class="cf-settings-help">
          Choose who completes the next part of this process.
        </p>
        <div class="cf-workflow-add-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.draft.steps.length >= 40"
            @click="model.add('nudge')"
          >
            Add agent nudge
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.draft.steps.length >= 40"
            @click="model.add('ai')"
          >
            Add AI step</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.draft.steps.length >= 40"
            @click="model.add('approval')"
          >
            Add approval</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="model.draft.steps.length >= 40"
            @click="model.add('checklist')"
          >
            Add checklist
          </button>
        </div>
      </details>
      <details class="cf-workflow-presets">
        <summary>Standard step presets</summary>
        <p class="cf-settings-help">Adds a configured step to your draft.</p>
        <div class="cf-workflow-add-actions">
          <button
            v-for="preset in WORKFLOW_PRESETS"
            :key="preset.id"
            type="button"
            class="cf-btn cf-btn-ghost"
            :disabled="model.draft.steps.length >= 40"
            @click="model.addPreset(preset.id)"
          >
            Add {{ preset.name }} preset
          </button>
        </div>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.resetStandard()"
        >
          Replace draft with standard workflow
        </button>
        <p class="cf-settings-help">
          Replaces local edits only. Save workflow applies the change.
        </p>
      </details>
    </div>
  </section>
</template>
