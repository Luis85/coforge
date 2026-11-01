<script setup lang="ts">
import { useWorkflowAiFields } from "../../composables/coforge/use-workflow-ai-fields";
import {
  WORKFLOW_ACCESS_LABELS,
  WORKFLOW_OUTPUT_LABELS,
} from "../../stores/workflow-editor-draft";
import WorkflowOutputTemplatePicker from "./WorkflowOutputTemplatePicker.vue";
import ProviderModelFields from './ProviderModelFields.vue';
import WorkflowExecutionPolicy from './WorkflowExecutionPolicy.vue';
import WorkflowNativeTools from './WorkflowNativeTools.vue';
const fields = useWorkflowAiFields();
</script>
<template>
  <div v-if="fields.step" class="cf-workflow-ai-fields">
    <label class="cf-field"
      ><span>Step instructions</span
      ><textarea
        v-model="fields.step.instructions"
        aria-label="Step instructions"
        data-workflow-field="instructions"
        rows="7"
        maxlength="8000"
        spellcheck="false"
      /><small
        >Describe the task and what a useful answer contains. The general
        project prompt is included at dispatch.</small
      ></label
    >
    <div class="cf-workflow-output-section">
      <h3>Shape the answer</h3>
      <label class="cf-field"
        ><span>Result contract</span
        ><select
          v-model="fields.step.output"
          aria-label="Result contract"
          data-workflow-field="output"
        >
          <option
            v-for="(label, value) in WORKFLOW_OUTPUT_LABELS"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option></select
        ><small
          >The host validates this result before advancing. Choose Markdown
          report for a free-form answer.</small
        ></label
      >
      <WorkflowOutputTemplatePicker
        v-model="fields.step.outputTemplateId"
        :project-id="fields.projectId"
      />
    </div>
    <p
      class="cf-workflow-current-options"
      aria-label="Current step configuration"
    >
      {{ fields.agentSummary }} ·
      {{ WORKFLOW_ACCESS_LABELS[fields.step.access] }} ·
      {{ fields.step.automatic ? "Automatic when resumed" : "On request" }} ·
      {{ fields.step.inputs?.length || 0 }} required previous results.
      <template v-if="fields.step.includePreviousResults">Other earlier results are included.</template>
    </p>
    <details class="cf-workflow-options">
      <summary>Agent and project access</summary>
      <p class="cf-settings-help">
        {{ fields.agentSummary }} ·
        {{ WORKFLOW_ACCESS_LABELS[fields.step.access] }}. Instructions and
        templates cannot expand these permissions.
      </p>
      <label class="cf-field"><span>Step agent configuration</span>
        <select v-model="fields.coworker.mode" aria-label="Step agent configuration">
          <option value="manual">Configure provider, model and effort</option>
          <option value="coworker" :disabled="!fields.coworker.choices.length && fields.step.coworkerId === undefined">Assign a saved CoWorker</option>
        </select>
      </label>
      <template v-if="fields.coworker.mode === 'coworker'">
        <label class="cf-field"><span>Assigned CoWorker</span>
          <select v-model="fields.coworker.selection" aria-label="Assigned CoWorker" data-workflow-field="coworkerId">
            <option value="">Choose an enabled saved CoWorker</option>
            <option v-for="agent in fields.coworker.choices" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
            <option v-if="fields.coworker.unavailable" :value="fields.step.coworkerId" disabled>{{ fields.step.coworkerId }} · unavailable saved CoWorker</option>
          </select>
          <small>Each new run captures this CoWorker's role, instructions, provider, model and effort. Step access, bound inputs and final review remain authoritative.</small>
        </label>
        <p v-if="fields.coworker.selected" class="cf-settings-help">{{ fields.agentSummary }}. Switch to manual configuration to customize these provider values for this step.</p>
        <p v-if="fields.coworker.unavailable" class="cf-inline-error" role="status">This CoWorker is missing or disabled. Choose an enabled profile or switch to manual configuration before starting new work.</p>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="fields.coworker.loading" @click="fields.coworker.refresh()">Refresh saved CoWorkers</button>
      </template>
      <p v-if="fields.coworker.error" class="cf-settings-help" role="status">{{ fields.coworker.error }}</p>
      <p v-else-if="!fields.coworker.loading && !fields.coworker.choices.length" class="cf-settings-help">Create and enable a saved CoWorker on CoWorkers to make it available here. Manual provider configuration remains available.</p>
      <div v-if="fields.coworker.mode === 'manual'" class="cf-workflow-field-grid">
        <label class="cf-field"
          ><span>AI provider</span
          ><select
            v-model="fields.step.provider"
            aria-label="AI provider"
            data-workflow-field="provider"
          >
            <option
              v-for="provider in fields.providers"
              :key="provider.value"
              :value="provider.value"
            >
              {{ provider.title }}
            </option>
          </select></label
        >
        <ProviderModelFields :choice="fields.step" model-label="AI model" />
      </div>
      <label class="cf-field"
        ><span>Project access</span
        ><select
          v-model="fields.step.access"
          aria-label="Project access"
          data-workflow-field="access"
        >
          <option
            v-for="(label, value) in WORKFLOW_ACCESS_LABELS"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select></label
      >
      <label v-if="fields.step.provider === 'herdr' && fields.coworker.mode === 'manual'" class="cf-field"
        ><span>Herdr agent type</span
        ><select v-model="fields.step.herdrAgent" aria-label="Herdr agent type">
          <option :value="undefined">Claude Code (default)</option>
          <option value="claude">Claude Code</option></select
        ><small
          >A dedicated managed Claude Code agent is launched for each attempt.
          CoForge validates its task-correlated result file; delivery alone is
          not completion.</small
        ></label
      >
      <p v-if="fields.step.provider === 'herdr'" class="cf-settings-help">
        Herdr does not report reliable automatic tokens or costs. Its
        interactive spending and turn limits are configured externally; native
        CLI caps do not enforce Herdr spending.
      </p>
    </details>
    <p v-if="fields.readiness" class="cf-workflow-readiness" role="status">
      {{ fields.readiness }} Configuration can still be saved.
    </p>
    <WorkflowExecutionPolicy />
    <WorkflowNativeTools :effective-provider="fields.coworker.effective?.provider" :provider-resolved="fields.coworker.mode === 'manual' || !!fields.coworker.selected" />
    <details class="cf-workflow-options">
      <summary>Automation and previous results</summary>
      <p class="cf-settings-help">
        {{
          fields.step.automatic
            ? "Runs automatically when the project is resumed and its prerequisites are met."
            : "Waits for an explicit Run action."
        }}
        {{ fields.step.inputs?.length || 0 }} required previous results.
      </p>
      <label class="cf-workflow-check"
        ><input v-model="fields.step.automatic" type="checkbox" /><span
          >Run automatically when project automation is resumed</span
        ></label
      >
      <label class="cf-field"
        ><span>Minimum votes before this step</span
        ><input
          v-model.number="fields.step.minVotes"
          aria-label="Minimum votes before this step"
          data-workflow-field="minVotes"
          type="number"
          min="0"
          max="10000"
          step="1"
          inputmode="numeric"
      /></label>
      <fieldset
        class="cf-workflow-input-roles"
        data-workflow-field="inputs"
        tabindex="-1"
      >
        <legend>Required previous results</legend>
        <p class="cf-settings-help">
          Choose results this step needs from earlier steps. A disabled result
          has no preceding producer.
        </p>
        <label v-if="fields.step.inputs?.length" class="cf-workflow-check">
          <input v-model="fields.step.includePreviousResults" type="checkbox" />
          <span>Include other earlier results</span>
        </label>
        <p class="cf-settings-help">Required results must remain valid. With no required selections, all available earlier results are included.</p>
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
    </details>
  </div>
</template>
