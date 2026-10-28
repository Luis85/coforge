<script setup lang="ts">
import { useStudioShell } from "../../composables/coforge/use-studio-app";
import CfIcon from "./CfIcon.vue";

const model = useStudioShell();
</script>
<template>
  <div class="cf-pipeline-strip">
    <div class="cf-pipeline-identity">
      <span
        class="cf-pipeline-light"
        :class="{ 'is-enabled': !model.paused }"
      />
      <span>{{ model.paused ? "Workflow paused" : "Workflow running" }}</span>
    </div>
    <div class="cf-pipeline-stages">
      <span
        v-for="item in model.stages"
        :key="item.stage"
        class="cf-pipeline-stage"
        :class="{ 'is-enabled': item.enabled, 'is-working': item.working }"
      >
        <span>{{ item.number }}</span
        >{{ item.label }}<CfIcon name="chevron-right" size="xs" />
      </span>
      <span class="cf-pipeline-human"
        ><CfIcon name="shield-check" size="sm" /> Your review</span
      >
    </div>
    <button
      type="button"
      class="cf-icon-button"
      :disabled="model.store.busy"
      :aria-label="model.paused ? 'Start automation' : 'Pause automation'"
      :title="
        model.paused
          ? 'Resume automatic workflow steps'
          : 'Pause new agent jobs'
      "
      @click="model.togglePause()"
    >
      <CfIcon :name="model.paused ? 'play' : 'pause'" size="sm" />
    </button>
    <button
      type="button"
      class="cf-icon-button"
      aria-label="Configure workflow"
      @click="model.store.navigate('workflow-settings')"
    >
      <CfIcon name="settings" size="sm" />
    </button>
  </div>
</template>
