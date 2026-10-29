<script setup lang="ts">
import { useWorkflowCouncil } from '../../composables/coforge/use-workflow-council';
import { WORKFLOW_OUTPUT_LABELS } from '../../stores/workflow-editor-draft';
import CouncilRecipients from './CouncilRecipients.vue';
const model = useWorkflowCouncil();
</script>
<template>
  <div v-if="model.step" class="cf-workflow-ai-fields">
    <p v-if="model.error" role="alert">{{ model.error }}</p>
    <label class="cf-field"><span>Council</span><select v-model="model.step.councilId" required>
      <option value="">Select Council</option>
      <option v-for="council in model.selection.councils" :key="council.id" :value="council.id">{{ council.name }}</option>
    </select></label>
    <p v-if="!model.selection.councils.length" class="cf-settings-help">Set up an enabled Council for this project in The Council → Definitions.</p>
    <CouncilRecipients :selection="model.selection" />
    <label class="cf-field"><span>Question for the Council</span><textarea v-model="model.step.instructions" required rows="5" maxlength="8000" /></label>
    <p class="cf-settings-help">This step waits for all published Council answers. Later steps can use the attributed Markdown report. Designate an execution desktop in The Council first. Paused execution or recovery holds the workflow; delivery alone does not complete this step.</p>
    <label class="cf-check"><input v-model="model.step.automatic" type="checkbox" />Run automatically when this step is reached and project automation is resumed</label>
    <fieldset v-if="model.inputs.length" class="cf-workflow-input-roles">
      <legend>Include earlier results</legend>
      <p class="cf-settings-help">With no roles selected, all available earlier results are included. Select roles to narrow the captured context.</p>
      <label v-for="role in model.inputs" :key="role" class="cf-workflow-check"><input type="checkbox" :checked="model.step.inputs?.includes(role) ?? false" @change="model.toggleRole(role)" />{{ WORKFLOW_OUTPUT_LABELS[role] }}</label>
    </fieldset>
  </div>
</template>
