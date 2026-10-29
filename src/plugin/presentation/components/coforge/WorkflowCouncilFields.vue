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
      <option v-if="model.step.councilId && !model.selection.selected" :value="model.step.councilId" disabled>Saved Council unavailable · {{ model.step.councilId }}</option>
    </select></label>
    <p v-if="!model.selection.councils.length" class="cf-settings-help">Set up an enabled Council for this project in The Council → Setup → Councils & roster.</p>
    <CouncilRecipients :selection="model.selection" />
    <section aria-label="Live Council execution readiness">
      <p role="status" class="cf-settings-help">{{ model.readiness }}</p>
      <div class="cf-settings-actions">
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.loading" @click="model.refresh()">Refresh councils</button>
        <button type="button" class="cf-btn cf-btn-ghost" @click="model.openSetup()">Open Council setup</button>
        <button type="button" class="cf-btn cf-btn-ghost" @click="model.openRuntime()">Check runtime settings</button>
      </div>
      <p class="cf-settings-help">Save or discard a workflow draft before leaving this editor. Saving configuration does not start a Council or prove that a provider is ready.</p>
    </section>
    <label class="cf-field"><span>Question for the Council</span><textarea v-model="model.step.instructions" required rows="5" maxlength="8000" /></label>
    <p class="cf-settings-help">This step waits for all published Council answers. Later steps can use the attributed Markdown report. Designate an execution desktop in The Council first. Paused execution or recovery holds the workflow; delivery alone does not complete this step.</p>
    <p class="cf-settings-help">The combined workflow Markdown report is limited to 16,000 characters. Complete child answers remain readable; an oversized report holds the parent workflow. Keep the Council output limits and discussion protocol concise when configuring this action.</p>
    <label class="cf-check"><input v-model="model.step.automatic" type="checkbox" />Run automatically when this step is reached and project automation is resumed</label>
    <label class="cf-field"><span>Earlier workflow results</span><select :value="model.contextMode" @change="model.changeContextMode($event)">
      <option value="all">All available earlier results</option>
      <option value="selected">Only selected result roles</option>
      <option value="none">No earlier results</option>
    </select></label>
    <p class="cf-settings-help">The captured request is always included. This choice controls only earlier workflow results. Existing saved steps keep their original context behavior until you change this choice.</p>
    <fieldset v-if="model.contextMode === 'selected'" class="cf-workflow-input-roles">
      <legend>Include earlier results</legend>
      <p v-if="!model.inputs.length" class="cf-settings-help">No earlier result roles are available at this position. Choose no earlier results or move this step later.</p>
      <label v-for="role in model.inputs" :key="role" class="cf-workflow-check"><input type="checkbox" :checked="model.step.inputs?.includes(role) ?? false" @change="model.toggleRole(role)" />{{ WORKFLOW_OUTPUT_LABELS[role] }}</label>
    </fieldset>
  </div>
</template>
