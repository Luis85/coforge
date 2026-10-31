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
      This run uses these saved versions, including on retry. CoWorker and template edits and
      deletions affect future runs. Current host permissions and review gates
      still apply.
    </p>
    <section v-if="model.coworkers.length" aria-label="Captured CoWorkers">
      <h3>Captured CoWorkers</h3>
      <details v-for="coworker in model.coworkers" :key="coworker.stepId" class="cf-workflow-template-preview">
        <summary>{{ coworker.name }} · {{ coworker.stepName }}</summary>
        <p>{{ coworker.execution }}</p>
        <p>{{ coworker.role }}</p>
        <p>CoWorker revision <code>{{ coworker.revision }}</code></p>
        <MarkdownBody :source="coworker.instructions" />
      </details>
    </section>
    <section v-if="model.executionPolicies.length" aria-label="Captured execution policies">
      <h3>Captured Build execution</h3>
      <dl class="cf-settings-runtime-list"><div v-for="policy in model.executionPolicies" :key="policy.id"><dt>{{ policy.name }}</dt><dd>{{ policy.execution }} · {{ policy.deadline }} · {{ policy.turns }} turns/tool calls · USD{{ policy.budget }} configured cap</dd></div></dl>
      <p class="cf-settings-help">These values belong to this run. Current workflow changes affect future admissions; provider-specific enforcement and final review remain separate.</p>
    </section>
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
