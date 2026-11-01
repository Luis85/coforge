<script setup lang="ts">
import { usePolishingFeedback } from '../../composables/coforge/use-polishing-feedback';
import PolishingResultBody from './PolishingResultBody.vue';
import ReviewedSnapshotScope from './ReviewedSnapshotScope.vue';
const model = usePolishingFeedback();
</script>
<template>
  <div class="cf-overlay cf-help-overlay" @mousedown="model.focus.backdrop">
    <section :ref="model.focus.bind" class="cf-help-dialog cf-polishing-dialog" role="dialog" aria-modal="true" aria-label="Improve & polish current result" @keydown="model.focus.keydown">
      <header><h2>Improve &amp; polish</h2><button type="button" class="cf-btn cf-btn-ghost" :disabled="model.working === 'confirm'" @click="model.close()">Close polishing feedback</button></header>
      <p v-if="model.idea"><code>{{ model.idea.id }}</code> · {{ model.idea.title }}</p>
      <p>Improve this card’s current result using your feedback. The pass is independent: the main workflow’s progress and original proposal/history stay retained. Every result still needs your review before applying it.</p>
      <form @submit.prevent="model.prepare()">
        <label class="cf-field"><span>Feedback for this polishing pass</span><textarea v-model="model.ui.feedback" aria-label="Feedback for this polishing pass" rows="5" maxlength="8000" :disabled="model.working === 'confirm'" /><small>Required for each invocation. Feedback is captured separately from trusted saved pass instructions.</small></label>
        <p v-if="!model.config" class="cf-settings-help">This project has no enabled Improve &amp; polish configuration.</p>
        <div class="cf-settings-actions"><button type="submit" class="cf-btn cf-btn-secondary" :disabled="Boolean(model.working) || model.storeBusy">{{ model.working === 'preview' ? 'Reviewing current result…' : 'Review improvement pass' }}</button><button v-if="!model.config" type="button" class="cf-btn cf-btn-secondary" @click="model.configure()">Configure Improve &amp; polish</button></div>
      </form>
      <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
      <section v-if="model.preview" class="cf-background-build-preview" aria-label="Review polishing pass">
        <h3>Review the current result and proposed pass</h3>
        <p>Current result: {{ model.targetLabel }} · {{ model.accessLabel }}. Current files and permissions are rechecked at confirmation; opening or previewing does not call a provider.</p>
        <details class="cf-workflow-options"><summary>Current result being polished</summary><PolishingResultBody :value="model.preview.target.value" /></details>
        <dl class="cf-background-build-facts">
          <div><dt>Captured pass provider / model / effort</dt><dd>{{ model.preview.step.provider }} · {{ model.preview.step.model }} · {{ model.preview.step.effort ?? 'Provider default' }}</dd></div>
          <div v-if="model.preview.coworker"><dt>Captured CoWorker</dt><dd>{{ model.preview.coworker.name }} · {{ model.preview.coworker.revision }}</dd></div>
          <div v-if="model.managedPreview"><dt>Agent session</dt><dd>{{ model.sessionHelp }}</dd></div>
          <div v-if="model.preview.primaryCheckpoint"><dt>Retained main workflow checkpoint</dt><dd>{{ model.preview.primaryCheckpoint.runId }} · cursor {{ model.preview.primaryCheckpoint.cursor }} · {{ model.preview.primaryCheckpoint.state }}</dd></div>
        </dl>
        <details class="cf-workflow-options"><summary>Captured instructions and persona</summary><pre class="cf-workflow-code-block" tabindex="0">{{ model.preview.step.instructions }}</pre><template v-if="model.preview.coworker"><p>{{ model.preview.coworker.role }}</p><pre class="cf-workflow-code-block" tabindex="0">{{ model.preview.coworker.instructions }}</pre></template></details>
        <section v-if="model.preview.inspection" aria-label="Reviewed code snapshot">
          <h4>Actual code source being reviewed</h4>
          <dl class="cf-background-build-facts">
            <div><dt>Source</dt><dd>{{ model.preview.inspection.sourceKind === 'repository' ? model.preview.inspection.increment || model.preview.inspection.fileCount ? 'Current repository with reviewed changes' : 'Current clean repository' : 'Attributed workspace' }}</dd></div>
            <div v-if="model.preview.inspection.sourceWorkspaceId"><dt>Retained workspace</dt><dd>{{ model.preview.inspection.sourceWorkspaceId }}</dd></div>
            <div><dt>Repository base</dt><dd>{{ model.preview.inspection.baseCommit }}</dd></div>
            <div><dt>Captured changes</dt><dd>{{ model.preview.inspection.fileCount }} changed files · {{ model.preview.inspection.totalBytes }} bytes</dd></div>
            <div><dt>Snapshot</dt><dd>{{ model.preview.inspection.snapshot.contentHash }}</dd></div>
            <div><dt>Observed at</dt><dd>{{ model.preview.inspection.observedAt }}</dd></div>
          </dl>
          <ReviewedSnapshotScope :inspection="model.preview.inspection" />
          <p v-if="model.preview.inspection.sourceKind === 'repository'">Earlier result context is retained for the task; it does not establish that those historical changes exist in this clean repository base. The agent starts from the actual reviewed repository snapshot.</p>
          <p v-else>A separate owned worktree continues the actual reviewed changes below. The original attributed workspace stays retained and untouched.</p>
          <PolishingResultBody v-if="model.preview.inspection.increment" :value="{ increment: model.preview.inspection.increment }" />
          <p v-else>No pending changes in this verified snapshot. Review this base before confirming.</p>
        </section>
        <p v-if="model.preview.readiness" class="cf-settings-help">{{ model.preview.readiness.message }}</p>
        <p v-if="model.providerHelp" class="cf-settings-help">{{ model.providerHelp }}</p>
        <label v-if="model.preview.oldExecutorAcknowledgementRequired" class="cf-workflow-check"><input v-model="model.stopped" type="checkbox" aria-label="I inspected earlier polishing source executors" />I inspected earlier polishing source executors and confirmed they stopped. Legacy cessation is operator-confirmed, not a verified process identity.</label>
        <label class="cf-workflow-check"><input v-model="model.reviewed" type="checkbox" aria-label="I reviewed the current result and feedback" />I reviewed the current result and feedback, captured settings and any code snapshot for this pass.</label>
        <label v-if="model.preview.stopHold" class="cf-workflow-check"><input v-model="model.releaseHold" type="checkbox" aria-label="Release this Stop hold for polishing" />Release this Stop hold for polishing. The main workflow’s checkpoint is retained.</label>
        <button type="button" class="cf-btn cf-btn-primary" :disabled="!model.canConfirm" @click="model.confirm()">{{ model.working === 'confirm' ? 'Queuing polishing pass…' : 'Confirm Improve & polish' }}</button>
      </section>
      <button type="button" class="cf-btn cf-btn-secondary" :disabled="model.working === 'confirm'" @click="model.close()">Cancel polishing pass</button>
    </section>
  </div>
</template>
