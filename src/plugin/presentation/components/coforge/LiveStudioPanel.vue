<script setup lang="ts">
import { useLiveStudio } from "../../composables/coforge/use-live-studio";
const model = useLiveStudio();
</script>
<template>
  <section class="cf-live-studio" aria-label="Live stream monitor">
    <header class="cf-live-heading">
      <h2>Live monitor</h2>
      <button
        v-if="model.canPreview && !model.example"
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.preview()"
      >
        Explore studio example
      </button>
      <button
        v-if="model.example"
        type="button"
        class="cf-btn cf-btn-secondary"
        title="Return to actual observations and discard example scene edits"
        @click="model.exitExample()"
      >
        Exit example
      </button>
    </header>
    <p v-if="model.example" class="cf-settings-help">
      Example live metrics · synthetic data, not a connected channel or OBS
      instance.
    </p>
    <div class="cf-live-readings">
      <section aria-label="Live viewers">
        <h3>Viewers</h3>
        <p class="cf-live-value">{{ model.viewer }}</p>
        <p>{{ model.viewerStatus }}</p>
        <small>{{ model.updated(model.state.viewers.checkedAt) }}</small>
      </section>
      <section aria-label="Live chat activity">
        <h3>Chat activity</h3>
        <dl class="cf-live-chat">
          <div>
            <dt>Messages</dt>
            <dd>{{ model.messages }}</dd>
          </div>
          <div>
            <dt>Commands</dt>
            <dd>{{ model.commands }}</dd>
          </div>
        </dl>
        <p>{{ model.chatCoverage }}</p>
        <small>{{ model.updated(model.state.chat.checkedAt) }}</small>
      </section>
      <section aria-label="Live OBS health">
        <h3>OBS health</h3>
        <p>{{ model.obsStatus }}</p>
        <dl class="cf-live-health">
          <div v-for="row in model.healthRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </div>
        </dl>
        <small
          >{{ model.updated(model.state.obs.checkedAt) }} · refreshed every 5
          seconds. Frame-drop percentage is cumulative.</small
        >
      </section>
    </div>
  </section>
</template>
