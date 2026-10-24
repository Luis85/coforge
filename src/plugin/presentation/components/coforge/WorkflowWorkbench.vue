<script setup lang="ts">
import type { WorkflowModel } from '../../composables/coforge/use-workflow';
import CfIcon from './CfIcon.vue';

defineProps<{ model: WorkflowModel }>();
</script>
<template>
  <aside class="cf-workflow-aside">
    <section class="cf-workflow-run-summary">
      <h3><CfIcon name="bot" /> On the workbench</h3>
      <template v-if="model.active">
        <span class="cf-badge cf-status-building">
          <CfIcon name="loader-circle" size="xs" class="cf-spin" /> {{ model.active.label }}
        </span>
        <button type="button" class="cf-workflow-idea-link" @click="model.openIdea(model.active.ideaId)">
          <span class="cf-mono">{{ model.active.ideaId }}</span>
          <strong>{{ model.active.title }}</strong>
          <CfIcon name="chevron-right" />
        </button>
        <p class="cf-workflow-help">{{ model.active.lastLog }}</p>
        <button
          type="button" class="cf-btn cf-btn-secondary cf-workflow-full-button" :disabled="model.store.busy"
          @click="model.cancel(model.active.id)"
        >
          <CfIcon name="square" size="xs" /> Cancel run
        </button>
      </template>
      <div v-else class="cf-workflow-workbench-empty">
        <span class="cf-workflow-idle-icon"><CfIcon name="check" size="lg" /></span>
        <strong>Ready for what’s next</strong>
        <p>{{ model.idleText }}</p>
      </div>
    </section>
    <section class="cf-workflow-priority-note">
      <h3>How the queue works</h3>
      <ol>
        <li>Only eligible, screened ideas advance.</li>
        <li>Within each stage, higher RICE scores go first.</li>
        <li>Votes break ties, then oldest ideas go first.</li>
        <li>Stages take turns; one agent runs at a time.</li>
      </ol>
      <div class="cf-workflow-inline">
        <CfIcon name="git-branch" size="sm" />
        <span>{{ model.thresholdLabel }}</span>
      </div>
      <p class="cf-workflow-help">Pausing stops new automatic dispatches. The current run can finish, or you can cancel it.</p>
    </section>
  </aside>
</template>
