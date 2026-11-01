<script setup lang="ts">
import type { BackgroundBuildRetryInspection } from '../../../features/coforge/domain/background-build-retry';
defineProps<{ inspection: BackgroundBuildRetryInspection }>();
</script>
<template>
  <section class="cf-reviewed-snapshot-scope" aria-label="Reviewed snapshot capture scope">
    <h4>Reviewed snapshot scope</h4>
    <p v-if="inspection.sourceOwner" class="cf-settings-help">Actual attributed file owner: <template v-if="inspection.sourceOwner.kind === 'attempt'">attempt <code>{{ inspection.sourceOwner.attemptId }}</code> · job <code>{{ inspection.sourceOwner.jobId }}</code></template><template v-else>materialization receipt <code>{{ inspection.sourceOwner.id }}</code></template>. File ownership does not establish process liveness.</p>
    <template v-if="inspection.captureScope === 'coforge-source-code/v1'">
      <p class="cf-settings-help">Tracked files and allowed manual files, including allowed Git-ignored files, remain in the reviewed source. Git-ignored dependency or private-control paths already denied to workflow agents are listed below; their contents are not transferred. Agent permissions do not expand.</p>
      <details v-if="inspection.excludedPaths?.length" class="cf-workflow-options"><summary>Excluded snapshot paths · {{ inspection.excludedPaths.length }}</summary>
        <ul class="cf-reviewed-scope-list" tabindex="0" aria-label="Excluded snapshot paths"><li v-for="entry in inspection.excludedPaths" :key="`${entry.path}:${entry.reason}`"><code>{{ entry.path }}</code> · {{ entry.reason === 'git-ignored-agent-denied-directory' ? 'Git-ignored directory already denied to workflow agents' : 'Git-ignored link already denied to workflow agents' }}</li></ul>
      </details>
      <p v-else class="cf-settings-help">No excluded paths were reported for this snapshot.</p>
    </template>
    <p v-else class="cf-settings-help">This legacy inspection does not record its capture scope or exclusions. No excluded paths are inferred from missing metadata.</p>
  </section>
</template>
