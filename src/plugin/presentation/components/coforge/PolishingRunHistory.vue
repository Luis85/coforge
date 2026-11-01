<script setup lang="ts">
import { usePolishingHistory } from '../../composables/coforge/use-polishing-history';
import PolishingResultBody from './PolishingResultBody.vue';
import WorkflowCapturedConfiguration from './WorkflowCapturedConfiguration.vue';
import DurableBuildStatus from './DurableBuildStatus.vue';
const props = defineProps<{ ideaId: string }>();
const history = usePolishingHistory(() => props.ideaId);
</script>
<template>
  <section v-if="history.total" class="cf-polishing-history" aria-label="Improve & polish results">
    <h3>Improve &amp; polish results</h3><p class="cf-settings-help">Independent passes preserve the main workflow checkpoint. Pending passes must be reviewed or dismissed before continuing it; failed attempts stay retained.</p>
    <p v-if="history.error" class="cf-inline-error" role="alert">{{ history.error }}</p>
    <details v-for="row in history.rows" :key="row.pass.id" class="cf-workflow-options" open>
      <summary>{{ row.label }} · {{ row.time }} · {{ row.status }}</summary>
      <p>Pass <code>{{ row.pass.id }}</code> · main checkpoint {{ row.pass.primaryCheckpoint?.runId ?? 'No main workflow run' }}<template v-if="row.pass.primaryCheckpoint"> · cursor {{ row.pass.primaryCheckpoint.cursor }}</template></p>
      <details><summary>Captured operator feedback</summary><pre class="cf-workflow-code-block" tabindex="0">{{ row.pass.feedback }}</pre></details>
      <PolishingResultBody v-if="row.result" :value="row.result" />
      <p v-if="row.problem || row.pass.workflow.error" class="cf-inline-error" role="alert">{{ row.problem || row.pass.workflow.error }}</p>
      <DurableBuildStatus :idea-id="ideaId" :run-id="row.pass.workflow.id" />
      <p v-if="row.unsettled" class="cf-settings-help">The original agent is still active or its state has not yet been confirmed. Check that session before applying, dismissing or replacing this pass.</p>
      <p v-if="row.applyExplanation" class="cf-settings-help">{{ row.applyExplanation }}</p>
      <p v-if="history.pending.startsWith(`${row.pass.id}:`)" role="status">Waiting for the reviewed operation. Output, feedback and the original checkpoint remain retained.</p>
      <p v-if="row.canStartNew" class="cf-settings-help">The previous attempt, feedback and retained changes stay in history. A new improvement opens a fresh preview for your review and confirmation.</p>
      <div class="cf-settings-actions"><button v-if="row.canStartNew" type="button" class="cf-btn cf-btn-primary" :disabled="Boolean(history.pending)" @click="history.startNew(row.pass.id)">Start new improvement</button><button v-if="row.canReview" type="button" class="cf-btn cf-btn-primary" :disabled="Boolean(history.pending)" @click="history.apply(row.pass.id)">{{ row.applyLabel }}</button><button v-if="row.canDismiss" type="button" class="cf-btn cf-btn-secondary" :disabled="Boolean(history.pending)" @click="history.reject(row.pass.id)">{{ row.result ? 'Reject polishing result' : 'Dismiss polishing attempt' }}</button><button v-if="row.canStop && !row.canStartNew" type="button" class="cf-btn cf-btn-secondary" :disabled="Boolean(history.pending)" @click="history.stop(row.pass.id)">Stop polishing pass</button></div>
      <details v-if="row.pass.applyIntentHistory?.length"><summary>Retained Apply copy attempts</summary><ul><li v-for="intent in row.pass.applyIntentHistory" :key="intent.id"><code>{{ intent.id }}</code> · {{ intent.workspaceEpoch }} · {{ intent.createdAt }}</li></ul></details>
      <details v-if="row.pass.sourceArtifacts.length"><summary>Captured source artifact provenance</summary><ul><li v-for="artifact in row.pass.sourceArtifacts" :key="`${artifact.runId}:${artifact.id}`"><code>{{ artifact.id }}</code> · source run {{ artifact.runId }} · {{ artifact.output }} · {{ artifact.contentHash }}</li></ul></details>
      <WorkflowCapturedConfiguration :run="row.pass.workflow" />
    </details>
    <button v-if="history.total > 5" type="button" class="cf-btn cf-btn-secondary" @click="history.expanded = !history.expanded">{{ history.expanded ? 'Show recent polishing passes' : `Show all ${history.total} polishing passes` }}</button>
  </section>
</template>
