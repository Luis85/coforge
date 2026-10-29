<script setup lang="ts">
import { useCouncilModel } from '../../composables/coforge/use-council';
import MarkdownBody from './MarkdownBody.vue';
const model = useCouncilModel();
</script>
<template>
  <section v-if="model.selectedRun" :ref="model.display.bindAnswers" tabindex="-1" class="cf-council-answers" aria-label="Council answers">
    <header>
      <h3>{{ model.display.title(model.selectedRun) }}</h3>
      <p><strong>{{ model.display.selectedCouncil }}</strong> · {{ model.runState(model.selectedRun) }}<span v-if="model.selectedRun.limits?.simulation"> · Simulation</span></p>
      <p class="cf-settings-help">{{ model.display.project(model.selectedRun) }}</p>
    </header>
    <p v-if="!model.display.published.length">{{ model.selectedRun.state === 'completed' ? 'This run completed without published answers. Inspect its captured steps and messages below.' : 'No answers have been published yet. Follow this run below; delivery alone is not a completed answer.' }}</p>
    <p v-if="model.display.unpublished" role="status">{{ model.display.unpublished }} recorded contribution(s) await publication. They are not presented as published answers.</p>
    <article v-for="artifact in model.display.published" :key="artifact.id" class="cf-council-answer">
      <h4>{{ model.artifactLabel(model.selectedRun, artifact) }}</h4>
      <p class="cf-settings-help">{{ artifact.simulated ? 'Simulation · ' : '' }}{{ artifact.provider }} · {{ artifact.model }}<span v-if="artifact.skipped"> · Missing contribution</span></p>
      <p v-if="artifact.skipped">{{ artifact.skipReason || 'This contribution was explicitly skipped.' }}</p>
      <MarkdownBody v-else :source="artifact.markdown" />
      <p v-if="artifact.messageRejection" role="status" class="cf-inline-error">Proposed messages were not delivered: {{ artifact.messageRejection.reason }}</p>
      <p v-else-if="artifact.messagesRejected" role="status">Proposed messages were not delivered. Inspect the retained evidence for their outcome.</p>
      <details><summary>Contribution reference and reported usage</summary>
        <p><time :datetime="artifact.createdAt">{{ artifact.createdAt }}</time> · {{ artifact.costUsd === undefined ? 'Cost not reported' : `$${artifact.costUsd.toFixed(4)} USD reported` }}</p>
        <pre>{{ JSON.stringify(artifact, null, 2) }}</pre>
      </details>
    </article>
    <p class="cf-settings-help">Contributions retain their own authors and rounds. Agreement or consensus is not inferred.</p>
  </section>
</template>
