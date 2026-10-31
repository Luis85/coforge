<script setup lang="ts">
import type { IdeaRunHistory } from '../../composables/coforge/idea-run-history';

defineProps<{ job: IdeaRunHistory }>();
</script>
<template>
  <div class="cf-idea-history" role="region" aria-label="Chat history">
    <p v-if="job.simulated" class="cf-idea-help">Simulation · No LLM was contacted. Input and response are illustrative.</p>
    <p v-else-if="job.external" class="cf-idea-help">The external app's conversation is unavailable. This shows the supplied task context and submitted result.</p>
    <template v-else-if="job.conversation">
      <p class="cf-idea-help">Captured before dispatch; capture alone does not confirm delivery.</p>
      <p class="cf-idea-help">Includes the initial prompt and recorded output. Intermediate tool turns are not retained.</p>
    </template>
    <template v-if="job.conversation">
      <section class="cf-idea-message">
        <h4>{{ job.promptLabel }}</h4>
        <time :datetime="job.conversation.capturedAt" :title="job.conversation.capturedAt">{{ job.capturedLabel }}</time>
        <pre class="cf-idea-transcript">{{ job.conversation.prompt.text }}</pre>
        <p v-if="job.conversation.prompt.truncated" class="cf-idea-help cf-idea-truncation">Prompt capture truncated; only the retained beginning is shown.</p>
      </section>
      <section class="cf-idea-message">
        <h4>{{ job.outputLabel }}</h4>
        <template v-if="job.conversation.response">
          <time v-if="job.conversation.responseCapturedAt" :datetime="job.conversation.responseCapturedAt" :title="job.conversation.responseCapturedAt">{{ job.responseLabel }}</time>
          <pre class="cf-idea-transcript">{{ job.conversation.response.text }}</pre>
          <p v-if="job.conversation.response.truncated" class="cf-idea-help cf-idea-truncation">Response capture truncated; only the retained beginning is shown.</p>
          <p class="cf-idea-help">Response captured for this attempt. Review remains required.</p>
          <p v-if="job.provider === 'claude'" class="cf-idea-help">Recognizable credentials in Claude response captures are redacted.</p>
        </template>
        <p v-else class="cf-idea-help">{{ job.missingResponse }}</p>
      </section>
      <details class="cf-idea-evidence">
        <summary>System instructions</summary>
        <pre class="cf-idea-transcript">{{ job.conversation.instructions.text }}</pre>
        <p v-if="job.conversation.instructions.truncated" class="cf-idea-help cf-idea-truncation">Instruction capture truncated; only the retained beginning is shown.</p>
      </details>
    </template>
    <p v-else class="cf-idea-help">{{ job.missingHistory }}</p>
    <details class="cf-idea-evidence">
      <summary>Execution log</summary>
      <pre class="cf-idea-code">{{ job.log }}</pre>
    </details>
  </div>
</template>
