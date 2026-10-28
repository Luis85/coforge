<script setup lang="ts">
import { useWorkflowAiFields } from "../../composables/coforge/use-workflow-ai-fields";
import {
  WORKFLOW_ACCESS_LABELS,
  WORKFLOW_OUTPUT_LABELS,
} from "../../stores/workflow-editor-draft";
const fields = useWorkflowAiFields();
</script>
<template>
  <div v-if="fields.step" class="cf-workflow-ai-fields">
    <div class="cf-workflow-field-grid">
      <label class="cf-field"
        ><span>Result contract</span
        ><select v-model="fields.step.output" aria-label="Result contract">
          <option
            v-for="(label, value) in WORKFLOW_OUTPUT_LABELS"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select></label
      ><label class="cf-field"
        ><span>Project access</span
        ><select v-model="fields.step.access" aria-label="Project access">
          <option
            v-for="(label, value) in WORKFLOW_ACCESS_LABELS"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select></label
      >
    </div>
    <p class="cf-settings-help">
      The result must match its selected contract. Access controls what this
      step can inspect or edit; instructions cannot expand it.
    </p>
    <div class="cf-workflow-field-grid">
      <label class="cf-field"
        ><span>AI provider</span
        ><select v-model="fields.step.provider" aria-label="AI provider">
          <option
            v-for="provider in fields.providers"
            :key="provider.value"
            :value="provider.value"
          >
            {{ provider.title }}
          </option>
        </select></label
      ><label class="cf-field"
        ><span>AI model</span
        ><input
          v-model="fields.step.model"
          aria-label="AI model"
          maxlength="100"
          required
          :disabled="fields.step.provider === 'demo'"
          pattern="[a-zA-Z0-9][a-zA-Z0-9._:\-]{0,99}"
        /><small>{{
          fields.step.provider === "demo"
            ? "Simulation makes no model call; the model is retained for later."
            : "This model is captured when the task is queued."
        }}</small></label
      >
    </div>
    <label v-if="fields.step.provider === 'herdr'" class="cf-field"
      ><span>Herdr agent type</span
      ><select v-model="fields.step.herdrAgent" aria-label="Herdr agent type">
        <option :value="undefined">Claude Code (default)</option>
        <option value="claude">Claude Code</option></select
      ><small
        >A dedicated managed Claude Code agent is launched for each attempt.
        CoForge validates its task-correlated result file; delivery alone is not
        completion.</small
      ></label
    >
    <p v-if="fields.step.provider === 'herdr'" class="cf-settings-help">
      Herdr does not report reliable automatic tokens or costs. Its interactive
      spending and turn limits are configured externally; native CLI caps do not
      enforce Herdr spending.
    </p>
    <p v-if="fields.readiness" class="cf-workflow-readiness" role="status">
      {{ fields.readiness }} Configuration can still be saved.
    </p>
    <label class="cf-field"
      ><span>Step instructions</span
      ><textarea
        v-model="fields.step.instructions"
        aria-label="Step instructions"
        rows="10"
        maxlength="8000"
        spellcheck="false"
      /><small
        >The general project prompt is prefixed at dispatch. Required output
        schemas and host restrictions remain in force.</small
      ></label
    >
    <div class="cf-workflow-field-grid">
      <label class="cf-field"
        ><span>Minimum votes before this step</span
        ><input
          v-model.number="fields.step.minVotes"
          aria-label="Minimum votes before this step"
          type="number"
          min="0"
          max="10000"
          step="1"
          inputmode="numeric" /></label
      ><label class="cf-workflow-check"
        ><input v-model="fields.step.automatic" type="checkbox" /><span
          >Run automatically when project automation is resumed</span
        ></label
      >
    </div>
    <fieldset class="cf-workflow-input-roles">
      <legend>Required previous results</legend>
      <p class="cf-settings-help">
        Optional dependencies on the latest valid result of a preceding step. A
        workflow cannot require a result before a producer exists.
      </p>
      <label
        v-for="(label, role) in WORKFLOW_OUTPUT_LABELS"
        :key="role"
        class="cf-workflow-check"
        ><input
          type="checkbox"
          :checked="fields.step.inputs?.includes(role)"
          :disabled="
            !fields.roles.find((item) => item.id === role)?.available &&
            !fields.step.inputs?.includes(role)
          "
          @change="fields.toggleRole(role)"
        /><span>{{ label }}</span></label
      >
    </fieldset>
  </div>
</template>
