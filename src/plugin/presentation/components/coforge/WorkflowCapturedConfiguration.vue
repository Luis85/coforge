<script setup lang="ts">
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { useCapturedWorkflowConfiguration } from "../../composables/coforge/use-captured-workflow-configuration";
import MarkdownBody from "./MarkdownBody.vue";
const props = defineProps<{ run: WorkflowRun }>();
const model = useCapturedWorkflowConfiguration(() => props.run);
</script>
<template>
  <details
    class="cf-workflow-options"
    aria-label="Captured workflow configuration"
  >
    <summary>Captured configuration · {{ model.startedAt }}</summary>
    <p>
      <strong>{{ model.workflowName }}</strong> · workflow revision
      <code>{{ model.workflowRevision }}</code>
    </p>
    <p class="cf-settings-help">
      This run uses these saved versions, including on retry. Template edits and
      deletions affect future runs. Current host permissions and review gates
      still apply.
    </p>
    <p v-if="!model.templates.length" class="cf-settings-help">
      No output templates were captured for this run.
    </p>
    <details
      v-for="template in model.templates"
      :key="template.id"
      class="cf-workflow-template-preview"
    >
      <summary>{{ template.name }} · {{ template.steps }}</summary>
      <p>
        Template revision <code>{{ template.revision }}</code>
      </p>
      <MarkdownBody :source="template.markdown" />
      <details>
        <summary>Markdown source</summary>
        <pre
          class="cf-workflow-json"
          tabindex="0"
          :aria-label="`Captured Markdown source for ${template.name}`"
          >{{ template.markdown }}</pre>
      </details>
    </details>
  </details>
</template>
