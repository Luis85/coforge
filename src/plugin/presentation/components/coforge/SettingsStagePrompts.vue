<script setup lang="ts">
import { useSettingsForm } from "../../composables/coforge/use-settings";
const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" aria-label="Workflow step configuration">
    <div class="cf-settings-description">
      <h2>Workflow steps</h2>
      <p>
        Choose who runs each step, its model and its task prompt. CoForge keeps
        tool, output and streamer-review gates in place.
      </p>
    </div>
    <div class="cf-settings-fields">
      <p class="cf-settings-help">
        {{ model.promptOrigin }} · a blank prompt uses the default. Save
        settings to use changes in new tasks.
      </p>
      <label class="cf-field"
        ><span>Workflow step</span
        ><select v-model="model.store.promptStage" aria-label="Workflow step">
          <option
            v-for="stage in model.promptStages"
            :key="stage.id"
            :value="stage.id"
          >
            {{ stage.label }}
          </option>
        </select></label
      >
      <div class="cf-step-agent-fields">
        <div class="cf-field">
          <label :for="`${model.store.layoutId}-step-provider`"
            >Step provider</label
          ><select
            :id="`${model.store.layoutId}-step-provider`"
            v-model="model.draft.stageAgents[model.store.promptStage].provider"
            :disabled="model.pending"
            :aria-describedby="`${model.store.layoutId}-provider-help`"
          >
            <option value="">
              Use project default ({{ model.defaultProviderLabel }})
            </option>
            <option
              v-for="provider in model.providers"
              :key="provider.value"
              :value="provider.value"
            >
              {{ provider.title }}
            </option></select
          ><small :id="`${model.store.layoutId}-provider-help`">{{
            model.stepAgent.providerInherited
              ? "Inherits the project provider."
              : "Provider override for this step."
          }}</small>
        </div>
        <div class="cf-field">
          <label :for="`${model.store.layoutId}-step-model`">Step model</label
          ><input
            :id="`${model.store.layoutId}-step-model`"
            v-model="model.draft.stageAgents[model.store.promptStage].model"
            maxlength="100"
            :disabled="model.pending || model.stepAgent.provider === 'demo'"
            :placeholder="`Project default: ${model.draft.model}`"
            pattern="[a-zA-Z0-9][a-zA-Z0-9._:\-]{0,99}"
            :aria-describedby="`${model.store.layoutId}-model-help`"
          /><small :id="`${model.store.layoutId}-model-help`">{{
            model.stepAgent.provider === "demo"
              ? "Not used by Simulation; a saved override is kept for later."
              : model.stepAgent.modelInherited
                ? "Blank inherits the project model."
                : "Model override for this step."
          }}</small>
        </div>
      </div>
      <label v-if="model.stepAgent.provider === 'herdr'" class="cf-field">
        <span>Step Herdr agent type</span>
        <select
          v-model="model.draft.stageAgents[model.store.promptStage].herdrAgent"
          :disabled="model.pending"
          aria-label="Step Herdr agent type"
        >
          <option :value="undefined">Use project default (Claude Code)</option>
          <option value="claude">Claude Code</option>
        </select>
        <small
          >Only the verified managed Claude Code profile is supported. Each
          attempt launches a dedicated agent with the selected model.</small
        >
      </label>
      <p class="cf-settings-help">
        Effective runner: <strong>{{ model.effectiveStepLabel }}</strong>
      </p>
      <p v-if="model.stepAgent.provider === 'herdr'" class="cf-settings-help">
        CoForge validates a task-correlated result file before advancing the
        request. Delivery or idle status alone does not complete a step. Herdr
        does not report reliable automatic token usage or costs. Configure
        interactive agent spending and turn limits externally; CoForge’s native
        CLI budget cap does not enforce Herdr spending.
      </p>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.pending"
        @click="model.resetStepAgent()"
      >
        Use project defaults for this step
      </button>
      <h3>Task prompt</h3>
      <label class="cf-field"
        ><span>Project stage prompt</span
        ><textarea
          v-model="model.draft.stagePrompts[model.store.promptStage]"
          aria-label="Project stage prompt"
          rows="10"
          maxlength="8000"
          :disabled="model.pending"
        />
      </label>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.pending"
        @click="model.resetStagePrompt()"
      >
        Reset selected stage prompt
      </button>
      <p v-if="model.pending" class="cf-settings-help">
        Finish or cancel this project's active tasks before saving prompt
        changes.
      </p>
      <details class="cf-prompt-preview">
        <summary>Preview assembled dispatch</summary>
        <p>
          Previewing does not run an agent. The general project prompt prefixes
          the request payload; these system instructions define the stage task.
        </p>
        <p>Dispatch: {{ model.effectiveStepLabel }}</p>
        <h3>System instructions</h3>
        <pre tabindex="0">{{ model.promptSystem }}</pre>
        <label class="cf-field"
          ><span>Preview request</span
          ><select
            v-model="model.store.promptPreviewIdea"
            aria-label="Preview request"
          >
            <option value="">Choose a request</option>
            <option
              v-for="idea in model.store.projectIdeas"
              :key="idea.id"
              :value="idea.id"
            >
              {{ idea.id }} · {{ idea.title }}
            </option>
          </select></label
        >
        <h3>Request payload</h3>
        <pre tabindex="0">{{ model.promptPayload }}</pre>
      </details>
    </div>
  </section>
</template>
