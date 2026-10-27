<script setup lang="ts">
import { useSettingsForm } from "../../composables/coforge/use-settings";
const model = useSettingsForm();
</script>
<template>
  <section class="cf-settings-section" aria-label="Workflow stage prompts">
    <div class="cf-settings-description">
      <h2>Stage prompts</h2>
      <p>
        Customize each task for this project. Tool, output and streamer-review
        gates remain managed by CoForge.
      </p>
    </div>
    <div class="cf-settings-fields">
      <p class="cf-settings-help">{{ model.promptOrigin }} · a blank prompt uses the default. Save settings to use changes in new tasks.</p>
      <label class="cf-field"
        ><span>Prompt stage</span
        ><select v-model="model.store.promptStage" aria-label="Prompt stage">
          <option
            v-for="stage in model.promptStages"
            :key="stage.id"
            :value="stage.id"
          >
            {{ stage.label }}
          </option>
        </select></label
      >
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
