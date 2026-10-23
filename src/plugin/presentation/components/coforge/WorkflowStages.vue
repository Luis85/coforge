<script setup lang="ts">
import type { WorkflowModel } from '../../composables/coforge/use-workflow';
import CfIcon from './CfIcon.vue';

defineProps<{ model: WorkflowModel }>();
</script>
<template>
  <div class="cf-workflow-stage-list">
    <section v-for="stage in model.stages" :key="stage.id" class="cf-workflow-stage" :class="{ 'is-running': stage.isActive }">
      <div class="cf-workflow-stage-rail">
        <span class="cf-workflow-stage-icon">
          <CfIcon v-if="stage.isActive" name="loader-circle" size="lg" class="cf-spin" />
          <CfIcon v-else :name="stage.icon" size="lg" />
        </span>
        <span v-if="!stage.last" class="cf-workflow-stage-line" />
      </div>
      <div class="cf-workflow-stage-body">
        <div class="cf-workflow-stage-heading">
          <h3>{{ stage.title }}</h3>
          <label class="cf-workflow-toggle">
            <span>{{ stage.automated ? 'Auto' : 'Manual' }}</span>
            <input
              type="checkbox" class="cf-workflow-toggle-input" :aria-label="stage.toggleLabel" :checked="stage.automated"
              :disabled="model.store.busy || stage.blocked" @click.prevent="model.toggleStage(stage.id)"
            >
            <span class="cf-workflow-toggle-track" />
          </label>
        </div>
        <p>{{ stage.description }}</p>
        <div class="cf-workflow-stage-flow">
          <span>{{ stage.input }}</span>
          <CfIcon name="arrow-right" size="sm" />
          <span>{{ stage.output }}</span>
          <span v-if="stage.isActive" class="cf-workflow-running-label">Running</span>
        </div>
        <p v-if="stage.blocked" class="cf-workflow-help cf-workflow-stage-limit">{{ model.blockedText }}</p>
      </div>
    </section>
    <section class="cf-workflow-human-gate">
      <div class="cf-workflow-stage-icon">
        <CfIcon name="clipboard-check" size="lg" />
      </div>
      <div>
        <h3>
          The final call is yours
          <span class="cf-badge cf-status-shipped">Always manual</span>
        </h3>
        <p>
          Inspect the increment, request changes, or accept it. Acceptance records your decision; use your game’s release process to
          publish.
        </p>
      </div>
    </section>
  </div>
</template>
