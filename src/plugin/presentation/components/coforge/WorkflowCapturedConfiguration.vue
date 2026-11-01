<script setup lang="ts">
import type { WorkflowRun } from "../../../features/coforge/domain/configured-workflow-run";
import { useCapturedWorkflowConfiguration } from "../../composables/coforge/use-captured-workflow-configuration";
import MarkdownBody from "./MarkdownBody.vue";
import WorkflowBackgroundRetryHistory from './WorkflowBackgroundRetryHistory.vue';
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
      This run retains these captured task, provider, CoWorker and template versions.
      Explicit background retry approvals are recorded separately below. Current
      host permissions and review gates still apply.
    </p>
    <p v-if="model.providerContextHelp" class="cf-settings-help">{{ model.providerContextHelp }}</p>
    <WorkflowBackgroundRetryHistory :run="run" />
    <section v-if="model.codingProfiles.length" aria-label="Captured attempt coding profiles">
      <h3>Admitted coding profiles</h3>
      <p class="cf-settings-help">These profiles belong to the recorded attempts. Current workflow settings do not reinterpret an earlier admission.</p>
      <details v-for="profile in model.codingProfiles" :key="profile.id" class="cf-idea-evidence" :data-coding-profile="profile.profile">
        <summary>{{ profile.stepName }} · {{ profile.provider }} · {{ profile.title }}<span class="cf-idea-run-meta">Attempt <code>{{ profile.attemptId }}</code></span></summary>
        <p v-if="profile.profile !== 'legacy'" class="cf-settings-help">Captured profile <code>{{ profile.profile }}</code>.</p>
        <p class="cf-settings-help">{{ profile.help }}</p><p v-if="profile.assistants" class="cf-settings-help">{{ profile.assistants }}</p><p v-if="profile.boundary" class="cf-settings-help">{{ profile.boundary }}</p>
      </details>
    </section>
    <section v-if="model.nativePolicies.length" aria-label="Captured native tool policies">
      <h3>Saved requested tool options</h3>
      <dl class="cf-settings-runtime-list"><div v-for="policy in model.nativePolicies" :key="policy.id"><dt>{{ policy.name }}</dt><dd><span v-if="policy.tools.delegation">Saved native assistant limit · {{ policy.tools.delegation.maxConcurrent }} concurrent. </span><span v-if="policy.tools.verification">Saved isolated command selections: {{ policy.tools.verification.commandIds.join(', ') }}.</span></dd></div></dl>
      <p class="cf-settings-help">Saved options are distinct from admitted capabilities. A new coding profile can retain legacy command selections without using them. Activity retains each attempt’s actual profile and observed outcomes.</p>
    </section>
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
