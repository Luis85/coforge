<script setup lang="ts">
import { useWorkflowNudge } from "../../composables/coforge/use-workflow-nudge";
import { WORKFLOW_OUTPUT_LABELS } from "../../stores/workflow-editor-draft";
const model = useWorkflowNudge();
</script>
<template>
  <div v-if="model.step" class="cf-workflow-ai-fields">
    <p class="cf-settings-help">
      Creates a separate task for one agent. This step finishes when the task is
      admitted; follow its result in The Council → Activity → Runs &amp; answers.
    </p>
    <p v-if="model.error" role="alert">{{ model.error }}</p>
    <div class="cf-workflow-field-grid">
      <label class="cf-field"
        ><span>Project team</span
        ><select
          v-model="model.step.teamId"
          data-workflow-field="teamId"
          required
        >
          <option value="">Select team</option>
          <option v-for="team in model.teams" :key="team.id" :value="team.id">
            {{ team.name }}
          </option>
        </select></label
      >
      <label class="cf-field"
        ><span>Allowed agent recipient</span
        ><select
          v-model="model.step.agentId"
          data-workflow-field="agentId"
          required
        >
          <option value="">Select agent</option>
          <option
            v-for="agent in model.agents"
            :key="agent.id"
            :value="agent.id"
          >
            {{ agent.name }}
          </option>
        </select></label
      >
    </div>
    <label class="cf-field"
      ><span>Task prompt</span
      ><textarea
        v-model="model.step.instructions"
        data-workflow-field="instructions"
        rows="6"
        maxlength="8000"
        required
      />
    </label>
    <label class="cf-workflow-check"
      ><input v-model="model.step.automatic" type="checkbox" />Start
      automatically when this step is reached</label
    >
    <p class="cf-settings-help">
      The task receives the captured request and the earlier results selected
      below. Agent action tools are limited to its scoped CoForge MCP tools.
      Edit teams and allowed recipients in Council → Definitions.
    </p>
    <fieldset
      v-if="model.inputs.length"
      class="cf-workflow-input-roles"
      data-workflow-field="inputs"
      tabindex="-1"
    >
      <legend>Include earlier results</legend>
      <label v-for="role in model.inputs" :key="role" class="cf-workflow-check"
        ><input
          type="checkbox"
          :checked="model.step.inputs?.includes(role) ?? false"
          @change="model.toggleRole(role)"
        />{{ WORKFLOW_OUTPUT_LABELS[role] }}</label
      >
    </fieldset>
  </div>
</template>
