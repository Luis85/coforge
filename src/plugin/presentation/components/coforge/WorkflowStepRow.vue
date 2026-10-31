<script setup lang="ts">
import type { WorkflowStep } from '../../../features/coforge/domain/configured-workflow';
import { useWorkflowEditorForm } from '../../composables/coforge/use-workflow-editor';
import { WORKFLOW_KIND_LABELS, WORKFLOW_OUTPUT_LABELS } from '../../stores/workflow-editor-draft';
import CfIcon from './CfIcon.vue';
defineProps<{ step: WorkflowStep; index: number; count: number }>();
const model = useWorkflowEditorForm();
</script>
<template>
  <li :data-step-id="step.id" :class="{ 'is-selected': step.id === model.selectedId }">
    <button type="button" class="cf-workflow-step-select" :aria-current="step.id === model.selectedId ? 'step' : undefined" @click="model.select(step.id)">
      <span class="cf-workflow-step-number">{{ index + 1 }}</span>
      <span><strong>{{ step.name || 'Unnamed step' }}</strong><small>{{ step.kind === 'ai' ? WORKFLOW_OUTPUT_LABELS[step.output] : WORKFLOW_KIND_LABELS[step.kind] }}</small></span>
    </button>
    <div class="cf-workflow-step-actions">
      <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Move ${step.name} up`" :disabled="index === 0" @click="model.move(step.id, -1)"><CfIcon name="arrow-up" size="sm" /></button>
      <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Move ${step.name} down`" :disabled="index === count - 1" @click="model.move(step.id, 1)"><CfIcon name="arrow-down" size="sm" /></button>
      <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Duplicate ${step.name}`" :disabled="model.draft.steps.length >= 40" @click="model.duplicate(step.id)"><CfIcon name="copy" size="sm" /></button>
      <button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Remove ${step.name} from workflow`" @click="model.remove(step.id)"><CfIcon name="trash-2" size="sm" /></button>
    </div>
  </li>
</template>
