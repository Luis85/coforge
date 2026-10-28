<script setup lang="ts">
import type {
  ApprovalWorkflowStep,
  ChecklistWorkflowStep,
} from "../../../features/coforge/domain/configured-workflow";
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { useConfiguredManualStep } from "../../composables/coforge/use-configured-manual-step";
import MarkdownBody from "./MarkdownBody.vue";
const props = defineProps<{
  ideaId: string;
  run: WorkflowRun;
  step: ApprovalWorkflowStep | ChecklistWorkflowStep;
}>();
const model = useConfiguredManualStep(props);
</script>
<template>
  <section class="cf-configured-manual" aria-label="Manual workflow step">
    <h3>{{ step.name }}</h3>
    <MarkdownBody v-if="step.instructions" :source="step.instructions" />
    <form @submit.prevent="model.complete()">
      <fieldset :disabled="model.form.saving">
        <legend class="cf-sr-only">{{ step.name }}</legend>
        <div v-if="step.kind === 'checklist'" class="cf-configured-checklist">
          <label
            v-for="item in step.items"
            :key="item.id"
            class="cf-workflow-check"
            ><input
              v-model="model.form.checked"
              type="checkbox"
              :value="item.id"
            /><span
              >{{ item.label
              }}<small v-if="item.required"> · required</small></span
            ></label
          >
        </div>
        <label class="cf-field"
          ><span>Decision note (optional)</span
          ><textarea v-model="model.form.note" maxlength="3000" rows="3" />
        </label>
        <p v-if="model.form.error" role="alert" class="cf-inline-error">
          {{ model.form.error }}
        </p>
        <p class="cf-settings-help">
          Completes this step for this request revision. Any actual code changes
          still need final streamer review.
        </p>
        <button
          type="submit"
          class="cf-btn cf-btn-primary"
          :disabled="!model.ready"
        >
          {{
            model.form.saving
              ? "Saving decision…"
              : step.kind === "approval"
                ? "Approve workflow step"
                : "Complete checklist step"
          }}
        </button>
      </fieldset>
    </form>
  </section>
</template>
