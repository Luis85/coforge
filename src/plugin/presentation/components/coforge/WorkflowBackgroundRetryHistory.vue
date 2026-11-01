<script setup lang="ts">
import type { WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { useBackgroundRetryHistory } from '../../composables/coforge/use-background-retry-history';
const props = defineProps<{ run: WorkflowRun }>();
const history = useBackgroundRetryHistory(() => props.run);
</script>
<template>
  <section v-if="history.approvals.length" class="cf-background-build-retry" aria-label="Approved background Build retries">
    <h3>Approved background Build retries</h3>
    <p class="cf-settings-help">These explicit attempt approvals retain the original captured workflow and task. Each retry continues from its reviewed snapshot; earlier steps and attempt history remain retained.</p>
    <details v-for="approval in history.approvals" :key="approval.id" class="cf-workflow-options">
      <summary>{{ approval.stepName }} · {{ approval.time }}</summary>
      <dl class="cf-background-build-facts">
        <div><dt>Admitted attempt</dt><dd>{{ approval.attemptId }} · {{ approval.jobId }}</dd></div>
        <div><dt>Effective background execution</dt><dd>{{ approval.deadline }} · {{ approval.idle }} · {{ approval.turns }} turns/tool calls · USD{{ approval.budget }} configured cap</dd></div>
        <div><dt>Approved policy source</dt><dd>{{ approval.policySource.kind }} · {{ approval.policySource.definitionRevision }}</dd></div>
        <div><dt>Reviewed snapshot</dt><dd>{{ approval.snapshot.contentHash }}</dd></div>
        <div><dt>Snapshot source</dt><dd>{{ approval.sourceKind === 'workspace' ? 'Retained workspace' : 'Verified repository' }} · {{ approval.baseCommit }}</dd></div>
      </dl>
      <p>{{ approval.priorAttemptCount }} earlier attempts were retained. {{ approval.oldExecutorStopped ? 'The operator confirmed the relevant earlier executors stopped.' : 'No earlier-executor cessation acknowledgement was required.' }} The snapshot was explicitly reviewed.</p>
      <p v-if="approval.releasedStopHold">The operator explicitly released this request’s Stop hold for this retry.</p>
    </details>
  </section>
</template>
