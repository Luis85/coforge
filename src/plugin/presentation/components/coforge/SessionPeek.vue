<script setup lang="ts">
import type { IdeaSessionsModel } from '../../composables/coforge/use-idea-sessions';
import SessionStream from './SessionStream.vue';
import WorkflowVerificationEvidence from './WorkflowVerificationEvidence.vue';
import CfIcon from './CfIcon.vue';
import RecordedAttemptFailure from './RecordedAttemptFailure.vue';
defineProps<{ model: IdeaSessionsModel }>();
</script>
<template>
  <section v-if="model.job" class="cf-session-peek" aria-label="Session Peek">
    <div class="cf-session-peek-heading">
      <h3 :ref="model.bindHeading" tabindex="-1">Peek · {{ model.title }}</h3>
      <button v-if="model.terminalAvailable" type="button" class="cf-btn cf-btn-secondary cf-idea-small-button" aria-label="Follow parent session in read-only terminal" :disabled="model.terminalPending" @click="model.terminal()"><CfIcon name="terminal" size="sm" />{{ model.terminalPending ? 'Opening follow…' : 'Read-only terminal' }}</button>
    </div>
    <RecordedAttemptFailure :job-id="model.job.id" />
    <p class="cf-idea-help">{{ model.captureHint }}</p>
    <p v-if="model.childCaptureUnavailable" class="cf-idea-help">Native assistant details were not captured for this attempt. Permission to delegate does not establish that assistants ran.</p>
    <dl class="cf-session-metadata">
      <div><dt>Parent attempt</dt><dd>{{ model.provider }} · {{ model.job.status }}</dd></div>
      <div><dt>Elapsed</dt><dd>{{ model.elapsed }}</dd></div>
      <div><dt>Last observed event</dt><dd>{{ model.lastObserved }}</dd></div>
    </dl>
    <p v-if="model.childId" class="cf-idea-help">This filters observations for an observed native assistant. Verification outcomes and terminal follow belong to the parent attempt.</p>
    <p v-if="model.terminalAvailable" class="cf-idea-help">Terminal follow shows the parent’s recorded feed. It accepts no provider input and does not attach to an interactive CLI session.</p>
    <p v-if="model.truncated" class="cf-session-notice">Earlier observations were truncated by the capture limit. Missing events are not reconstructed.</p>
    <p v-if="model.terminalError" class="cf-inline-error" role="alert">{{ model.terminalError }}</p>
    <SessionStream v-if="model.captureAvailable" :entries="model.entries" :selection-key="model.selectionKey" />
    <WorkflowVerificationEvidence :records="model.verification" />
    <div class="cf-session-links">
      <button v-if="model.incrementAvailable" type="button" class="cf-btn cf-btn-secondary" @click="model.increment()">Open current increment</button>
      <button v-if="!model.failed" type="button" class="cf-btn cf-btn-ghost" @click="model.activity()">Read original attempt details</button>
    </div>
  </section>
</template>
