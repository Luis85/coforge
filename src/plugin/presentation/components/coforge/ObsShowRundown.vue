<script setup lang="ts">
import { useObsShow } from "../../composables/coforge/use-obs-show";
const model = useObsShow();
</script>
<template>
  <div v-if="model.ui.draft" class="cf-show-desk">
    <section class="cf-show-rundown" aria-label="Plan rundown">
      <div class="cf-show-section-heading">
        <h3>Rundown</h3>
        <span>{{ model.totalDurationLabel }}</span>
      </div>
      <p>Choose a segment to review or edit. Selection never runs a cue.</p>
      <ol aria-label="Show rundown">
        <li
          v-for="(segment, index) in model.ui.draft.segments"
          :key="segment.id"
        >
          <button
            type="button"
            class="cf-show-segment"
            :aria-current="
              model.ui.selectedCue === segment.id ? 'step' : undefined
            "
            :disabled="model.ui.pending"
            @click="model.ui.selectedCue = segment.id"
          >
            <span class="cf-show-segment-number" aria-hidden="true">{{
              index + 1
            }}</span>
            <span class="cf-show-segment-content">
              <strong>{{ segment.name || "Untitled segment" }}</strong>
              <span
                >{{ model.segmentDuration(segment.durationSeconds) }} ·
                {{ segment.steps.length }}
                {{ segment.steps.length === 1 ? "action" : "actions" }}</span
              >
            </span>
            <span
              v-if="
                model.state.run?.cueId === segment.id &&
                model.state.run?.planId === model.ui.draft.id
              "
              class="cf-show-segment-outcome"
            >
              {{ model.state.run.status }}
            </span>
          </button>
        </li>
      </ol>
    </section>
    <section class="cf-show-runner" aria-label="Run the selected show cue">
      <div class="cf-show-section-heading">
        <h3>Run the show</h3>
        <span>{{ model.ui.dirty ? "Unsaved draft" : "Saved plan" }}</span>
      </div>
      <p>
        Plan: <strong>{{ model.saved?.name || model.ui.draft.name }}</strong>
      </p>
      <p class="cf-show-selected-title">
        {{ model.cue?.name || "Choose a segment" }}
      </p>
      <p v-if="model.cue">
        Segment {{ model.cuePosition }} of
        {{ model.ui.draft.segments.length }} ·
        {{ model.segmentDuration(model.cue.durationSeconds) }}
      </p>
      <div v-if="model.cue?.note" class="cf-show-presenter-notes">
        <h4>Private presenter notes</h4>
        <p>{{ model.cue.note }}</p>
      </div>
      <ol
        v-if="model.cue?.steps.length"
        class="cf-show-action-preview"
        aria-label="Selected cue actions"
      >
        <li v-for="(step, index) in model.cue.steps" :key="index">
          {{ model.describe(step) }}
        </li>
      </ol>
      <p v-else>
        No actions in this segment. Add an action in the editor below.
      </p>
      <p v-if="model.ui.dirty" class="cf-show-draft-warning">
        Save or discard your changes before running this cue.
      </p>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="!model.canRunCue"
          aria-describedby="cf-show-run-reason"
          @click="model.runCue()"
        >
          Run selected cue
        </button>
      </div>
      <p id="cf-show-run-reason">
        {{
          model.runDisabledReason ||
          "Runs the saved actions above in order. Each cue starts only when you run it."
        }}
      </p>
    </section>
  </div>
  <section
    v-if="model.state.run"
    class="cf-show-outcome cf-production-section"
    aria-label="Latest cue outcome"
  >
    <div class="cf-show-section-heading">
      <h3>{{ model.state.run.name }}</h3>
      <strong>{{ model.state.run.status }}</strong>
    </div>
    <p>
      Segment elapsed: {{ model.elapsed
      }}<span v-if="model.remaining"> · {{ model.remaining }}</span>
    </p>
    <p>Started {{ model.state.run.startedAt }}</p>
    <ol>
      <li v-for="(step, index) in model.state.run.steps" :key="index">
        {{ model.describe(step.action) }} · <strong>{{ step.status }}</strong>
      </li>
    </ol>
    <p v-if="model.state.run.error" class="cf-inline-error">
      {{ model.state.run.error }}
    </p>
    <button
      v-if="
        model.state.run.status === 'uncertain' ||
        model.state.run.status === 'failed'
      "
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.ui.pending"
      @click="model.recover()"
    >
      Acknowledge inspected partial cue
    </button>
  </section>
</template>
