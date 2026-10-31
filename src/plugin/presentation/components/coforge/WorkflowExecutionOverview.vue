<script setup lang="ts">
import { useWorkflowExecutionOverview } from "../../composables/coforge/use-workflow-execution-overview";
const execution = useWorkflowExecutionOverview();
</script>
<template>
  <section class="cf-idea-section" aria-label="Build execution policies">
    <h3>Build execution policies</h3>
    <p class="cf-settings-help">
      Background Builds use each step's captured execution policy. The
      short-task timeout and ordinary workflow resource bounds remain in effect
      for foreground steps.
    </p>
    <dl class="cf-settings-runtime-list">
      <div v-for="build in execution.builds" :key="build.id">
        <dt>{{ build.name }}</dt>
        <dd>
          <p>{{ build.execution }}</p>
          <button
            type="button"
            class="cf-btn cf-btn-ghost"
            @click="execution.configure(build.id)"
          >
            Configure {{ build.name }} execution
          </button>
        </dd>
      </div>
    </dl>
    <p v-if="!execution.builds.length" class="cf-settings-help">
      Add a code-change step with isolated worktree access to configure
      background execution.
    </p>
    <p class="cf-settings-help">
      Worker Node and vault-wide concurrency are configured in Vault
      integrations. Project Runtime shows their observed readiness.
    </p>
  </section>
</template>
