<script setup lang="ts">
import type { useBroadcast } from "../../composables/coforge/use-broadcast";
defineProps<{ model: ReturnType<typeof useBroadcast> }>();
</script>
<template>
  <section class="cf-broadcast-console" aria-label="Broadcast controls">
    <div>
      <span class="cf-broadcast-state" :class="{ 'is-live': model.active }">{{
        model.state.uncertain
          ? "CHECK OBS"
          : model.active
            ? "LIVE"
            : model.connected
              ? "OFF AIR"
              : "OBS"
      }}</span>
      <h2 role="status">{{ model.title }}</h2>
      <p>
        {{
          model.connected && !model.state.uncertain
            ? "Program scene"
            : "Last observed scene"
        }}: <strong>{{ model.currentScene }}</strong
        ><span v-if="model.active && model.state.snapshot?.timecode">
          · {{ model.elapsed }}</span
        >
      </p>
    </div>
    <div class="cf-broadcast-actions">
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canPrepare"
        @click="model.prepare()"
      >
        Prepare stream</button
      ><button
        type="button"
        class="cf-btn cf-btn-primary cf-go-live"
        :disabled="!model.canGoLive"
        @click="model.goLive()"
      >
        Go live</button
      ><button
        v-if="!model.state.onBreak"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canPause"
        @click="model.pause()"
      >
        Pause / BRB</button
      ><button
        v-else
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canResume"
        @click="model.resume()"
      >
        Resume stream</button
      ><button
        type="button"
        class="cf-btn cf-btn-danger"
        :disabled="!model.canStop"
        @click="model.stop()"
      >
        Stop stream
      </button>
    </div>
    <p>
      Go live starts broadcasting through OBS. Pause switches scenes while the
      stream stays live. OBS owns your stream destination and output
      credentials.
    </p>
    <p v-if="model.state.uncertain" class="cf-inline-error" role="alert">
      The previous interaction is unconfirmed. Refresh OBS state before another
      stream action.
    </p>
    <div class="cf-settings-actions">
      <button
        v-if="!model.connected"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.busy"
        @click="model.open()"
      >
        Open OBS Studio
      </button>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.busy || !model.connected"
        @click="model.refresh()"
      >
        Refresh OBS state</button
      ><button
        v-if="!model.connected"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.supported || model.busy"
        @click="model.connect()"
      >
        Connect OBS</button
      ><button
        v-else
        type="button"
        class="cf-btn cf-btn-ghost"
        :disabled="model.busy"
        @click="model.disconnect()"
      >
        Disconnect OBS
      </button>
    </div>
  </section>
</template>
