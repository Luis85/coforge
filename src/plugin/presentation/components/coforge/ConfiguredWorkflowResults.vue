<script setup lang="ts">
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { WORKFLOW_OUTPUT_LABELS } from "../../stores/workflow-editor-draft";
import ReadableContent from "./ReadableContent.vue";
defineProps<{ run: WorkflowRun }>();
</script>
<template>
  <section
    v-if="run.artifacts.length"
    class="cf-configured-results"
    aria-label="Workflow results"
  >
    <h3>Step results</h3>
    <details v-for="artifact in run.artifacts" :key="artifact.id">
      <summary>
        {{
          run.definition.steps.find((step) => step.id === artifact.stepId)
            ?.name || "Recorded step"
        }}
        · {{ WORKFLOW_OUTPUT_LABELS[artifact.output]
        }}<span v-if="run.invalidatedArtifactIds?.includes(artifact.id)">
          · superseded</span
        >
      </summary>
      <p
        v-if="run.invalidatedArtifactIds?.includes(artifact.id)"
        class="cf-settings-help"
      >
        Retained for history. Later steps cannot use this superseded result.
      </p>
      <ReadableContent
        v-if="artifact.markdown"
        :source="artifact.markdown"
      /><template v-if="artifact.screening"
        ><p>
          <strong>{{ artifact.screening.verdict }}</strong>
        </p>
        <ReadableContent :source="artifact.screening.reason" /></template
      ><template v-if="artifact.rice"
        ><p>
          <strong>RICE {{ artifact.rice.score.toLocaleString() }}</strong>
        </p>
        <ReadableContent :source="artifact.rice.rationale" /></template
      ><ReadableContent
        v-if="artifact.plan"
        :source="artifact.plan.markdown"
      /><ReadableContent v-if="artifact.summary" :source="artifact.summary" />
      <pre v-if="artifact.increment" class="cf-workflow-json" tabindex="0">{{
        artifact.increment.diff || "No changed files were recorded."
      }}</pre>
    </details>
  </section>
</template>
