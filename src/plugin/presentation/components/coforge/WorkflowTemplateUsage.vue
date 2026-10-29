<script setup lang="ts">
import { useTemplateUsage } from "../../composables/coforge/use-template-usage";
const props = defineProps<{
  projectId: string;
  templateId: string;
  revision?: string;
}>();
const model = useTemplateUsage(props);
</script>
<template>
  <section
    v-if="model.available"
    class="cf-workflow-template-usage"
    aria-label="Saved workflow template references"
  >
    <h3>Used by saved workflows</h3>
    <p v-if="model.state.loading" role="status">
      Checking saved workflow steps…
    </p>
    <p v-else-if="model.state.error" role="alert" class="cf-inline-error">
      {{ model.state.error }}
    </p>
    <template v-else>
      <ul v-if="model.state.references.length">
        <li
          v-for="item in model.state.references"
          :key="`${item.workflow}:${item.stepId}`"
        >
          {{
            item.workflow === "request"
              ? "Request workflow"
              : "Proposal workflow"
          }}
          · {{ item.workflowName }} · <strong>{{ item.stepName }}</strong>
        </li>
      </ul>
      <p v-else class="cf-settings-help">
        No known saved workflow steps use this template.
      </p>
      <p v-if="model.state.unavailable" role="alert" class="cf-inline-error">
        {{ model.state.unavailable }}
      </p>
    </template>
    <p class="cf-settings-help">
      Unsaved drafts and captured runs are separate. Deletion keeps existing run
      snapshots; listed steps must choose another template before a new run.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-ghost"
      :disabled="model.state.loading"
      @click="model.refresh()"
    >
      Refresh template references
    </button>
  </section>
</template>
