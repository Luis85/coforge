<script setup lang="ts">
import type { useSchedule } from "../../composables/coforge/use-schedule";
defineProps<{ model: ReturnType<typeof useSchedule> }>();
</script>
<template>
  <section aria-label="Planned OBS music">
    <h3>Music in OBS</h3>
    <p class="cf-schedule-section-help">
      Choose existing OBS Media or VLC sources for the Live and BRB scenes
      above. Prepare music adds new sources disabled and keeps existing
      memberships unchanged. Use Scenes or Show plan cues to enable them, then
      play, pause, stop, restart, mute or adjust volume. OBS owns the files and
      playback.
    </p>
    <button
      type="button"
      class="cf-btn"
      :disabled="model.store.busy || model.store.example"
      @click="model.refreshMusic"
    >
      Refresh OBS music sources
    </button>
    <div class="cf-schedule-fields">
      <label
        >Live scene music source<select
          :value="model.store.draft.music.liveInputId"
          @change="model.assignMusic('liveInputId', $event)"
        >
          <option value="">No music assignment</option>
          <option
            v-if="
              model.store.draft.music.liveInputId &&
              !model.musicInputs.some(
                (input) => input.id === model.store.draft.music.liveInputId,
              )
            "
            :value="model.store.draft.music.liveInputId"
          >
            Saved source - refresh OBS to verify
          </option>
          <option
            v-for="input in model.musicInputs"
            :key="input.id"
            :value="input.id"
          >
            {{ input.name }}
          </option>
        </select></label
      >
      <label
        >BRB scene music source<select
          :value="model.store.draft.music.breakInputId"
          @change="model.assignMusic('breakInputId', $event)"
        >
          <option value="">No music assignment</option>
          <option
            v-if="
              model.store.draft.music.breakInputId &&
              !model.musicInputs.some(
                (input) => input.id === model.store.draft.music.breakInputId,
              )
            "
            :value="model.store.draft.music.breakInputId"
          >
            Saved source - refresh OBS to verify
          </option>
          <option
            v-for="input in model.musicInputs"
            :key="input.id"
            :value="input.id"
          >
            {{ input.name }}
          </option>
        </select></label
      >
    </div>
    <p v-if="!model.musicInputs.length">
      Connect OBS and refresh to load existing music sources. Create or
      configure sources in OBS.
    </p>
  </section>
</template>
