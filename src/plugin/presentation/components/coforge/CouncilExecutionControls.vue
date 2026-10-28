<script setup lang="ts">
import { useCouncilModel } from "../../composables/coforge/use-council";
const model = useCouncilModel();
</script>
<template>
  <section class="cf-council-section" aria-label="Council execution">
    <h2>Execution controls</h2>
    <p>
      Check the native runtime and choose this desktop before explicitly
      resuming work. Reviewing definitions and preparing submissions does not
      start execution.
    </p>
    <div class="cf-settings-actions" aria-label="Council execution controls">
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.checkRuntime()"
      >
        Check native runtime
      </button>
      <span role="status">{{
        model.store.state?.paused ? "Execution paused" : "Execution resumed"
      }}</span>
      <button
        v-if="!model.store.state?.executor"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy || !model.store.state?.ready"
        @click="model.designate()"
      >
        Use this desktop for execution
      </button>
      <template v-else
        ><button
          v-if="model.store.state.paused"
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="model.store.busy"
          @click="model.resume()"
        >
          Resume Council execution</button
        ><button
          v-else
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.pause()"
        >
          Pause before next action
        </button></template
      >
    </div>
    <button
      v-if="model.store.state?.executor && model.projectId"
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.store.busy"
      @click="model.pauseProject()"
    >
      {{
        model.store.state.preferences.pausedProjectIds?.includes(
          model.projectId,
        )
          ? "Resume selected project"
          : "Pause selected project"
      }}
    </button>
  </section>
</template>
