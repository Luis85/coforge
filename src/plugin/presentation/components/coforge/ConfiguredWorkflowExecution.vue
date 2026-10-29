<script setup lang="ts">
import type { WorkflowModel } from "../../composables/coforge/use-workflow";
import ConfiguredManualStep from "./ConfiguredManualStep.vue";
import ConfiguredWorkflowResults from "./ConfiguredWorkflowResults.vue";
defineProps<{ model: WorkflowModel }>();
</script>
<template>
  <section class="cf-configured-run" aria-label="Request workflow execution">
    <label class="cf-field"
      ><span>Workflow request</span
      ><select
        :value="model.selected?.id ?? ''"
        aria-label="Workflow request"
        @change="model.selectRequest($event)"
      >
        <option v-if="!model.store.projectIdeas.length" value="">
          No requests yet
        </option>
        <option
          v-for="idea in model.store.projectIdeas"
          :key="idea.id"
          :value="idea.id"
        >
          {{ idea.id }} · {{ idea.title }}
        </option>
      </select></label
    >
    <template v-if="model.selected"
      ><div class="cf-configured-run-heading">
        <div>
          <h2>{{ model.selected.title }}</h2>
          <p>
            <code>{{ model.selected.id }}</code> · {{ model.definition.name }}
          </p>
        </div>
        <strong class="cf-configured-run-state">{{ model.runLabel }}</strong>
      </div>
      <p v-if="model.capturedEarlier" class="cf-workflow-policy">
        This run retains an earlier saved definition. Changes in Workflow
        settings apply to new runs.
      </p>
      <section v-if="model.uncertainNudges.length" aria-label="Agent nudge recovery">
        <h3>Inspect the original agent task</h3>
        <p>The previous task may have been admitted. Inspect its source and Council run before creating a fresh task.</p>
        <ul><li v-for="attempt in model.uncertainNudges" :key="attempt.id"><code>{{ attempt.nudgeSourcePath || attempt.id }}</code><span v-if="attempt.nudgeRunId"> · run {{ attempt.nudgeRunId }}</span></li></ul>
        <label class="cf-workflow-check"><input :checked="model.nudgeRecoveryConsent" type="checkbox" @change="model.changeNudgeRecovery($event)" />I inspected the original task and accept that a fresh attempt may duplicate it.</label>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.nudgeRecoveryConsent || model.store.busy" @click="model.acknowledgeNudge()">Acknowledge nudge recovery</button>
      </section>
      <ol class="cf-configured-progress" aria-label="Captured workflow steps">
        <li
          v-for="step in model.steps"
          :key="step.id"
          :class="{
            'is-current': step.current,
            'is-completed': step.completed,
          }"
        >
          <span class="cf-workflow-step-number">{{ step.index }}</span>
          <div>
            <strong>{{ step.name }}</strong
            ><small>{{ step.agent }}</small>
          </div>
          <span>{{
            step.current
              ? model.runLabel
              : step.completed
                ? "Completed"
                : step.state
          }}</span>
        </li>
      </ol>
      <ConfiguredManualStep
        v-if="
          model.run?.state === 'waiting-human' &&
          model.currentStep &&
          (model.currentStep.kind === 'approval' || model.currentStep.kind === 'checklist')
        "
        :key="`${model.run.id}:${model.currentStep.id}:${model.run.revision}`"
        :idea-id="model.selected.id"
        :run="model.run"
        :step="model.currentStep"
      />
      <template v-else
        ><p v-if="model.run?.error" role="alert" class="cf-inline-error">
          {{ model.run.error }}
        </p>
        <p v-if="model.blocked" class="cf-settings-help">{{ model.blocked }}</p>
        <div class="cf-settings-actions">
          <button
            v-if="model.canRunNext"
            type="button"
            class="cf-btn cf-btn-primary"
            @click="model.runNext()"
          >
            {{ model.runNextLabel }}</button
          ><button
            v-if="model.run?.state === 'awaiting-review'"
            type="button"
            class="cf-btn cf-btn-primary"
            @click="model.openIdea(model.selected.id)"
          >
            Review code changes</button
          ><button
            v-if="model.canRestart"
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.restart()"
          >
            Start a new workflow run
          </button>
        </div></template
      >
      <p v-if="model.run?.state === 'finished'" class="cf-workflow-policy">
        Workflow finished without pending code changes. No implementation or
        shipped-feature credit was created.
      </p>
      <button
        v-if="model.canStop"
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.stop()"
      >
        Stop this workflow run
      </button>
      <ConfiguredWorkflowResults v-if="model.run" :run="model.run" />
    </template>
    <div v-else class="cf-intent-empty">
      <h2>A request starts the workflow</h2>
      <p>
        Add a request on the Idea board, or accept one from Twitch chat, then
        select it here.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.store.navigate('board')"
      >
        Open Idea board
      </button>
    </div>
  </section>
</template>
