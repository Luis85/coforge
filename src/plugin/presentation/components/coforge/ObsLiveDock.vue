<script setup lang="ts">
import { useBroadcast } from "../../composables/coforge/use-broadcast";
const model = useBroadcast(false);
</script>
<template>
  <section
    v-if="model.state.snapshot?.active || model.state.uncertain"
    class="cf-obs-live-dock"
    aria-label="Broadcast quick controls"
  >
    <div>
      <strong>{{
        model.state.uncertain
          ? "Check OBS"
          : model.connected
            ? "On air"
            : "Last seen live · OBS disconnected"
      }}</strong>
      <span>{{ model.currentScene }}</span>
    </div>
    <div class="cf-settings-actions">
      <button
        v-if="!model.state.onBreak"
        type="button"
        class="cf-btn cf-btn-secondary"
        aria-label="Take a stream break"
        :disabled="!model.canPause"
        @click="model.pause()"
      >
        BRB
      </button>
      <button
        v-else
        type="button"
        class="cf-btn cf-btn-secondary"
        aria-label="Resume the stream"
        :disabled="!model.canResume"
        @click="model.resume()"
      >
        Resume
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        aria-label="Open the OBS audio mixer"
        @click="
          model.store.view = 'broadcast';
          model.store.broadcastTool = 'audio';
        "
      >
        Audio
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        aria-label="Open the live desk"
        @click="
          model.store.view = 'broadcast';
          model.store.broadcastTool = 'live';
        "
      >
        Live desk
      </button>
    </div>
    <p v-if="model.error" role="alert">{{ model.error }}</p>
  </section>
</template>
<style scoped>
.cf-obs-live-dock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--size-4-2);
  padding: var(--size-4-2) var(--size-4-4);
  background: var(--background-secondary);
  border-block-end: var(--border-width) solid var(--background-modifier-border);
  flex-shrink: 0;
}
.cf-obs-live-dock > div:first-child {
  display: flex;
  gap: var(--size-4-3);
  flex-wrap: wrap;
  min-width: 0;
}
.cf-obs-live-dock strong {
  color: var(--text-error);
}
.cf-obs-live-dock span {
  overflow-wrap: anywhere;
}
.cf-obs-live-dock p {
  flex-basis: 100%;
  margin: 0;
}
</style>
