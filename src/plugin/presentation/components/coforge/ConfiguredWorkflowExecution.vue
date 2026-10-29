<script setup lang="ts">
import type { WorkflowModel } from "../../composables/coforge/use-workflow";
import ConfiguredManualStep from "./ConfiguredManualStep.vue";
import ConfiguredWorkflowResults from "./ConfiguredWorkflowResults.vue";
import WorkflowCapturedConfiguration from "./WorkflowCapturedConfiguration.vue";
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
      <section class="cf-workflow-next-action" aria-label="Next workflow action">
        <h3>{{ model.nextActionHeading }}</h3>
        <p>{{ model.nextActionHelp }}</p>
      </section>
      <section v-if="model.councilAttempt" aria-label="Workflow Council activity">
        <h3>{{ model.councilName }}</h3>
        <p v-if="model.canCheckCouncil">Later steps wait for the published answer. Inspect this discussion for progress, paused execution or recovery.</p>
        <p v-else>This Council discussion remains available with its captured participants and attributed answers.</p>
        <p>Child run: <code>{{ model.councilAttempt.nudgeRunId }}</code></p>
        <div class="cf-settings-actions">
          <button type="button" class="cf-btn cf-btn-secondary" @click="model.inspectCouncil()">Read Council discussion</button>
          <button v-if="model.canCheckCouncil" type="button" class="cf-btn cf-btn-secondary" :disabled="model.store.busy" @click="model.checkCouncil()">Check Council answer</button>
        </div>
      </section>
      <section v-if="model.uncertainNudges.length" :aria-label="model.uncertainNudges.some(attempt => attempt.kind === 'council') ? 'Council task recovery' : 'Agent nudge recovery'">
        <h3>Inspect the original task</h3>
        <p>The previous task may have been admitted, or its cancellation may be unconfirmed. Inspect the retained source and original discussion before creating a fresh task.</p>
        <ul><li v-for="attempt in model.uncertainNudges" :key="attempt.id"><code>{{ attempt.nudgeSourcePath || attempt.id }}</code><span v-if="attempt.nudgeRunId"> · run {{ attempt.nudgeRunId }}</span></li></ul>
        <label class="cf-workflow-check"><input :checked="model.nudgeRecoveryConsent" type="checkbox" @change="model.changeNudgeRecovery($event)" />I inspected the original task and accept that a fresh attempt may duplicate it.</label>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.nudgeRecoveryConsent || model.store.busy" @click="model.acknowledgeNudge()">{{ model.uncertainNudges.some(attempt => attempt.kind === 'council') ? 'Acknowledge Council recovery' : 'Acknowledge nudge recovery' }}</button>
      </section>
      <ConfiguredManualStep
        v-if="
          model.run?.state === 'waiting-human' &&
          model.currentStep &&
          (model.currentStep.kind === 'approval' ||
            model.currentStep.kind === 'checklist')
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
      <div class="cf-workflow-progress-heading">
        <h3>Workflow progress</h3>
        <span>{{ model.progressLabel }}</span
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.editWorkflow()"
        >
          Edit future runs
        </button>
      </div>
      <ol class="cf-configured-progress" aria-label="Captured workflow steps">
        <li
          v-for="step in model.steps"
          :key="step.id"
          :aria-current="step.current ? 'step' : undefined"
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
      <p v-if="model.run?.state === 'finished'" class="cf-workflow-policy">
        {{
          model.selected.status === "shipped"
            ? "Code changes were accepted through final review. The completed workflow and its evidence are retained."
            : "Workflow finished without pending code changes. Completing the workflow alone does not accept code or create shipped-feature credit."
        }}
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
      <WorkflowCapturedConfiguration v-if="model.run" :run="model.run" />
      <details
        v-if="model.selected.workflowHistory?.length"
        class="cf-workflow-options"
        aria-label="Previous workflow configurations"
      >
        <summary>
          Previous run configurations ·
          {{ model.selected.workflowHistory.length }}
        </summary>
        <WorkflowCapturedConfiguration
          v-for="previous in model.selected.workflowHistory"
          :key="previous.id"
          :run="previous"
        />
      </details>
    </template>
    <div v-else class="cf-intent-empty">
      <h2>
        {{
          model.store.activeProject
            ? "A request starts the workflow"
            : "Choose a project"
        }}
      </h2>
      <p v-if="model.store.activeProject">
        Add a request on the Idea board, or accept one from Twitch chat, then
        select it here.
      </p>
      <p v-else>
        Create or select a project to run requests and configure its workflow.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="
          model.store.navigate(model.store.activeProject ? 'board' : 'projects')
        "
      >
        {{ model.store.activeProject ? "Open Idea board" : "Manage projects" }}
      </button>
    </div>
  </section>
</template>
