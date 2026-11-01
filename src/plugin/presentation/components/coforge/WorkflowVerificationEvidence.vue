<script setup lang="ts">
import type { WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';
import { useVerificationEvidence } from '../../composables/coforge/workflow-verification-display';
const props = defineProps<{ records: WorkflowVerificationRecord[]; currentHash?: string; historical?: boolean }>();
const evidence = useVerificationEvidence(props);
</script>
<template>
  <section v-if="evidence.records.length" class="cf-idea-section" aria-label="Observed verification commands">
    <h3>Observed verification commands</h3>
    <p class="cf-idea-help">CoForge recorded these command outcomes in an isolated Docker source copy. Exit zero does not verify every acceptance criterion. Agent summaries and written tests remain separate evidence.</p>
    <details v-for="record in evidence.records" :key="record.id" class="cf-idea-evidence cf-verification-evidence">
      <summary><strong>{{ record.label }}</strong> · {{ record.outcome }}<span class="cf-idea-run-meta">{{ record.snapshotLabel }} · <time :datetime="record.startedAt">{{ record.startedLabel }}</time></span></summary>
      <p v-if="record.status === 'unknown'" class="cf-idea-help">The command outcome is unknown. Restore the Docker runtime and reload CoForge to reconcile retained execution before retrying. Missing evidence never authorizes duplicate work.</p>
      <p v-else-if="record.status === 'unavailable'" class="cf-idea-help">Check the saved Docker executable, existing local image and command prerequisites in Vault integrations. No host execution fallback was used.</p>
      <p class="cf-idea-help">Command arguments are shown literally; this is not an executable shell snippet.</p>
      <pre class="cf-idea-code" tabindex="0" role="region" :aria-label="`Recorded command for ${record.label}`">{{ record.command }}</pre>
      <dl class="cf-settings-runtime-list">
        <div><dt>Producing attempt</dt><dd><code>{{ record.runId }}</code> · <code>{{ record.attemptId }}</code></dd></div>
        <div><dt>Source fingerprint</dt><dd><code>{{ record.sourceHash }}</code></dd></div>
        <div><dt>Captured image</dt><dd><code>{{ record.imageId }}</code></dd></div>
        <div v-if="record.finishedAt"><dt>Observed finish</dt><dd><time :datetime="record.finishedAt">{{ record.finishedLabel }}</time></dd></div>
      </dl>
      <p v-if="record.truncated" class="cf-idea-help">Output was truncated. The retained text is incomplete; the observed outcome remains recorded separately.</p>
      <pre class="cf-idea-code" tabindex="0" role="region" :aria-label="`Recorded output for ${record.label}`">{{ record.output || 'No output captured.' }}</pre>
    </details>
  </section>
</template>
