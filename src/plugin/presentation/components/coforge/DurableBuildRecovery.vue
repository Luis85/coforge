<script setup lang="ts">
import type { AgentJob } from "../../../features/coforge/domain/types";
import { useDurableBuildRecovery } from "../../composables/coforge/use-durable-build-recovery";
const props = defineProps<{ ideaId: string; runId?: string; job?: AgentJob }>();
const recovery = useDurableBuildRecovery(
  () => props.ideaId,
  () => props.runId,
  () => props.job,
);
</script>
<template>
  <details class="cf-workflow-options">
    <summary>Interrupted Build recovery</summary>
    <p class="cf-settings-help">
      Inspect retained evidence before asking CoForge to verify the original
      processes and workspace. Reading retained files does not establish that a
      worker is running or stopped.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="Boolean(recovery.working)"
      @click="recovery.inspect()"
    >
      {{
        recovery.working === "inspect"
          ? "Inspecting retained evidence…"
          : "Inspect retained Build evidence"
      }}
    </button>
    <section
      v-if="recovery.receipt"
      aria-label="Inspected retained Build evidence"
    >
      <p>
        Evidence inspected {{ recovery.inspectionTime }} · last recorded phase:
        {{ recovery.inspectedPhase }}
      </p>
      <details v-if="recovery.receipt.snapshot.increment">
        <summary>Retained workspace changes</summary>
        <p>{{ recovery.receipt.snapshot.increment.summary }}</p>
        <pre class="cf-workflow-code-block" tabindex="0">{{
          recovery.receipt.snapshot.increment.diff
        }}</pre>
      </details>
      <p v-else-if="recovery.receipt.snapshot.workspaceCaptured === true" class="cf-settings-help">
        Workspace capture verified: no pending changes.
      </p>
      <p v-else class="cf-settings-help">
        Workspace capture is not available. This does not establish that the workspace is empty. Inspect the original files and recorded activity before requesting recovery.
      </p>
      <pre
        v-if="recovery.receipt.snapshot.logs.length"
        class="cf-workflow-code-block"
        tabindex="0"
        >{{ recovery.receipt.snapshot.logs.join("\n") }}</pre>
    </section>
    <label class="cf-workflow-check"
      ><input
        v-model="recovery.consent"
        type="checkbox"
        aria-label="I reviewed the retained Build evidence"
        :disabled="!recovery.receipt || Boolean(recovery.working)"
      />I reviewed the retained evidence and want to verify and recover this
      execution into a stopped Inbox item.</label
    >
    <p class="cf-settings-help">
      Recovery records a Stop hold before verification. Unknown process
      ownership or workspace changes remain held for attention. It does not
      resume a provider or create a fresh run. Only the operator's normal
      Restart action may start again after confirmed recovery and review.
    </p>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="!recovery.canRecover"
      @click="recovery.recover()"
    >
      {{
        recovery.working === "recover"
          ? "Verifying original Build…"
          : "Verify and recover interrupted Build"
      }}
    </button>
    <p v-if="recovery.error" class="cf-inline-error" role="alert">
      {{ recovery.error }}
    </p>
  </details>
</template>
