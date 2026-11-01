<script setup lang="ts">
import { useBackgroundBuildRetry } from '../../composables/coforge/use-background-build-retry';
import ReviewedSnapshotScope from './ReviewedSnapshotScope.vue';
const props = defineProps<{ ideaId: string; runId?: string }>();
const retry = useBackgroundBuildRetry(() => props.ideaId, () => props.runId);
</script>
<template>
  <section v-if="retry.available" class="cf-background-build-retry" aria-label="Background Build retry">
    <details class="cf-workflow-options">
      <summary>Earlier build recovery options</summary>
    <template v-if="!retry.receipt">
      <p class="cf-settings-help">Keep completed steps and attempt history. Review the actual files before continuing this Build in a background worker.</p>
      <button :ref="retry.bindTrigger" type="button" class="cf-btn cf-btn-secondary" :disabled="Boolean(retry.working)" @click="retry.preview()">{{ retry.working === 'preview' ? 'Inspecting Build files…' : 'Retry Build in background' }}</button>
    </template>
    <section v-else :ref="retry.bindPanel" class="cf-background-build-preview" aria-label="Review background Build retry" tabindex="-1" @keydown="retry.keydown">
      <h3>Review background Build retry</h3>
      <p v-if="retry.receipt.inspection.sourceKind === 'workspace'">Continue from these actual reviewed partial changes in a fresh worker-owned workspace. The original workspace stays retained and untouched.</p>
      <p v-else>Start from this actual reviewed repository snapshot<template v-if="!retry.receipt.inspection.increment && !retry.receipt.inspection.fileCount"> · clean repository base with no included pending changes</template>. Earlier attempt evidence stays retained; only the included source is transferred.</p>
      <p>{{ retry.retainedSteps }} earlier steps, {{ retry.attemptCount }} attempts and {{ retry.artifactCount }} artifacts stay retained in this same run. Final human review still applies.</p>
      <dl class="cf-background-build-facts">
        <div><dt>Captured Build</dt><dd>{{ retry.receipt.step.name }}</dd></div>
        <div><dt>Captured provider / model / effort</dt><dd>{{ retry.receipt.step.provider }} · {{ retry.receipt.step.model }} · {{ retry.receipt.step.effort ?? 'Provider default' }}</dd></div>
        <div v-if="retry.receipt.coworker"><dt>Captured CoWorker</dt><dd>{{ retry.receipt.coworker.name }} · {{ retry.receipt.coworker.revision }}</dd></div>
        <div><dt>Policy source</dt><dd>{{ retry.receipt.policySource.kind === 'saved' ? 'Saved matching step policy' : 'Default background policy' }} · {{ retry.receipt.policySource.definitionRevision }}</dd></div>
        <div><dt>Original captured resource bounds</dt><dd>{{ retry.receipt.inheritedLimits.maxTurns }} turns/tool calls · USD{{ retry.receipt.inheritedLimits.maxBudgetUsd }} configured cap</dd></div>
        <div><dt>Effective background resource bounds</dt><dd>{{ retry.receipt.effectiveLimits.maxTurns }} turns/tool calls · USD{{ retry.receipt.effectiveLimits.maxBudgetUsd }} configured cap</dd></div>
        <div><dt>Background timing</dt><dd>{{ retry.deadline }} · {{ retry.idle }}</dd></div>
        <div><dt>Snapshot</dt><dd>{{ retry.receipt.inspection.snapshot.contentHash }}</dd></div>
        <div><dt>Snapshot base</dt><dd>{{ retry.receipt.inspection.baseCommit }}</dd></div>
        <div><dt>Recorded files</dt><dd>{{ retry.receipt.inspection.fileCount }} files · {{ retry.receipt.inspection.totalBytes }} bytes</dd></div>
        <div v-if="retry.receipt.source.sourceAttemptId"><dt>Workspace source attempt</dt><dd>{{ retry.receipt.source.sourceAttemptId }}</dd></div>
        <div v-if="retry.receipt.previousAttemptId"><dt>Latest failed attempt</dt><dd>{{ retry.receipt.previousAttemptId }}</dd></div>
      </dl>
      <ReviewedSnapshotScope :inspection="retry.receipt.inspection" />
      <details class="cf-workflow-options"><summary>Captured task and persona</summary><pre class="cf-workflow-code-block" tabindex="0">{{ retry.receipt.step.instructions }}</pre><template v-if="retry.receipt.coworker"><p>{{ retry.receipt.coworker.role }}</p><pre class="cf-workflow-code-block" tabindex="0">{{ retry.receipt.coworker.instructions }}</pre></template></details>
      <section aria-label="Reviewed Build snapshot">
        <h4>Actual reviewed files and changes</h4>
        <template v-if="retry.receipt.inspection.increment"><p>{{ retry.receipt.inspection.increment.summary }}</p><ul><li v-for="file in retry.receipt.inspection.increment.files" :key="file.path"><code>{{ file.path }}</code> · +{{ file.additions }} / −{{ file.deletions }}</li></ul><pre class="cf-workflow-code-block" tabindex="0">{{ retry.receipt.inspection.increment.diff }}</pre></template>
        <p v-else>No pending changes in this verified snapshot. Review the captured repository base before continuing.</p>
      </section>
      <p class="cf-settings-help">{{ retry.receipt.readiness.message }} Preview and readiness checks do not start a provider. Confirmation rechecks this exact snapshot and policy; changed files require another review. Native provider spending rules still apply; Codex does not enforce the Claude USD cap.</p>
      <label v-if="retry.receipt.inspection.humanCessationRequired" class="cf-workflow-check"><input v-model="retry.stopped" type="checkbox" aria-label="I inspected earlier Build executors and confirmed they stopped" />I inspected earlier Build executors and confirmed they stopped. For a legacy attempt, this records my inspection of all relevant executors, not a verified process-identity claim.</label>
      <p v-else class="cf-settings-help">No earlier Build executor. No cessation acknowledgement is required.</p>
      <label class="cf-workflow-check"><input v-model="retry.reviewed" type="checkbox" aria-label="I reviewed this Build snapshot" />I reviewed this Build snapshot and want the background Build to continue from these files and changes.</label>
      <label v-if="retry.receipt.stopHold" class="cf-workflow-check"><input v-model="retry.releaseHold" type="checkbox" aria-label="Release this request’s Stop hold for this retry" />Release this request’s Stop hold for this retry. This continues the current Build; it does not restart earlier workflow steps.</label>
      <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-primary" :disabled="!retry.canConfirm" @click="retry.confirm()">{{ retry.working === 'confirm' ? 'Queuing reviewed background Build…' : retry.receipt.stopHold ? 'Release Stop hold and confirm background retry' : 'Confirm background retry' }}</button><button type="button" class="cf-btn cf-btn-secondary" :disabled="Boolean(retry.working)" @click="retry.cancel()">Cancel background retry</button></div>
    </section>
    <p v-if="retry.error" role="alert" class="cf-inline-error">{{ retry.error }}</p>
    </details>
  </section>
</template>
