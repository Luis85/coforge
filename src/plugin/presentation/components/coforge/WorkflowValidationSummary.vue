<script setup lang="ts">
import { useWorkflowEditorForm } from "../../composables/coforge/use-workflow-editor";
const model = useWorkflowEditorForm();
</script>
<template>
  <section
    v-if="model.issues.length"
    class="cf-workflow-validation-summary"
    aria-label="Workflow validation"
  >
    <h2>Review before saving</h2>
    <p>
      Your draft is kept. Choose an issue to open its step and the field that
      needs attention.
    </p>
    <ul>
      <li v-for="issue in model.issues" :key="issue.id">
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.fixIssue(issue)"
        >
          {{ issue.label }}: {{ issue.message }}
        </button>
      </li>
    </ul>
  </section>
</template>
