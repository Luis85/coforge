<script setup lang="ts">
import type { WorkflowModel } from "../../composables/coforge/use-workflow";
import CfIcon from "./CfIcon.vue";

defineProps<{ model: WorkflowModel }>();
</script>
<template>
  <section class="cf-workflow-history">
    <div class="cf-workflow-section-heading">
      <div>
        <h2>Step attempts</h2>
        <p class="cf-workflow-help">
          A trace of each handoff, including failures and cancelled runs.
        </p>
      </div>
      <span class="cf-workflow-count">{{ model.runCount }} attempts</span>
    </div>
    <div v-if="model.runCount" class="cf-workflow-history-table">
      <div class="cf-workflow-history-head">
        <span>Request / step</span>
        <span>Provider</span>
        <span>Started</span>
        <span>Result</span>
      </div>
      <details
        v-for="job in model.visibleRuns"
        :key="job.id"
        class="cf-workflow-history-row"
      >
        <summary>
          <span class="cf-workflow-history-idea">
            <span class="cf-workflow-job-dot" :class="`is-${job.status}`" />
            <span>
              <strong>{{ job.ideaId }}</strong>
              <small>{{ job.stageLabel }}</small>
            </span>
          </span>
          <span class="cf-workflow-history-provider">{{
            job.providerLabel
          }}</span>
          <time>{{ job.time }}</time>
          <span class="cf-workflow-job-state" :class="`is-${job.status}`">
            {{ job.status }}
            <CfIcon name="chevron-right" size="sm" />
          </span>
        </summary>
        <div class="cf-workflow-history-body">
          <p class="cf-workflow-help">Started {{ job.time }}</p>
          <div class="cf-workflow-inline">
            <button
              type="button"
              class="cf-btn cf-btn-ghost cf-workflow-small-button"
              @click="model.openIdea(job.ideaId)"
            >
              Open idea <CfIcon name="arrow-right" size="sm" />
            </button>
            <span v-if="job.costText" class="cf-workflow-help">{{
              job.costText
            }}</span>
            <button
              v-if="job.canCancel"
              type="button"
              class="cf-btn cf-btn-ghost cf-workflow-small-button"
              :disabled="model.store.busy"
              @click="model.cancel(job.jobId)"
            >
              Cancel run
            </button>
          </div>
          <pre class="cf-workflow-code-block">{{ job.log }}</pre>
        </div>
      </details>
    </div>
    <div v-else class="cf-workflow-empty">
      <CfIcon name="bot" size="lg" />
      <h3>Your first run is waiting</h3>
      <p>
        Select a request and start its first step. Results, manual decisions and
        failed attempts remain traceable here.
      </p>
    </div>
    <button
      v-if="model.hasMoreRuns"
      type="button"
      class="cf-btn cf-btn-ghost cf-workflow-more"
      @click="model.toggleExpanded()"
    >
      {{ model.moreLabel }}
    </button>
  </section>
</template>
