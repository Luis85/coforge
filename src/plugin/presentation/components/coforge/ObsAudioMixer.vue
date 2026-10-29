<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
import ObsAudioAdvanced from "./ObsAudioAdvanced.vue";
defineProps<{ compact?: boolean }>();
const model = useObsProduction();
</script>
<template>
  <section class="cf-production-audio" aria-label="OBS audio mixer">
    <header class="cf-production-heading">
      <div>
        <h2>Audio mixer</h2>
        <p>
          OBS inputs · CoForge’s local music player is managed separately under
          Music.
        </p>
      </div>
      <button
        v-if="!compact"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.connected || model.ui.pending"
        @click="model.refresh()"
      >
        Refresh audio
      </button>
    </header>
    <p v-if="!model.audioInputs.length">
      Connect OBS and add an audio input in Create my studio or Sources &amp;
      layouts. No audio inputs are available yet.
    </p>
    <div
      v-for="input in model.audioInputs"
      :key="input.id"
      class="cf-production-channel"
    >
      <div class="cf-production-channel-title">
        <strong>{{ input.name }}</strong
        ><span>{{
          input.audio.muted === null
            ? "Mute unavailable"
            : input.audio.muted
              ? "Muted"
              : "Unmuted"
        }}</span>
      </div>
      <div class="cf-production-channel-controls">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :aria-label="`${input.audio.muted ? 'Unmute' : 'Mute'} ${input.name}`"
          :aria-pressed="input.audio.muted ?? false"
          :disabled="
            !model.canChange ||
            input.audio.muted === null ||
            !model.supports('input-mute')
          "
          @click="model.mute(input.id, !input.audio.muted)"
        >
          {{ input.audio.muted ? "Unmute" : "Mute" }}
        </button>
        <label class="cf-production-fader"
          ><span>{{ input.name }} volume</span
          ><input
            type="range"
            min="-60"
            max="0"
            step="1"
            :value="input.audio.volumeDb ?? -60"
            :disabled="
              !model.canChange ||
              input.audio.volumeDb === null ||
              !model.supports('input-volume')
            "
            @change="model.volume(input.id, $event)"
          /><output>{{
            input.audio.volumeDb === null
              ? "Unavailable"
              : `${input.audio.volumeDb.toFixed(1)} dB`
          }}</output></label
        >
        <div class="cf-production-meter">
          <meter
            v-if="input.audio.peakDb !== null"
            min="-60"
            max="0"
            low="-30"
            high="-6"
            optimum="-18"
            :value="input.audio.peakDb"
            :aria-label="`${input.name} peak level`"
          /><span>{{ model.peak(input.audio.peakDb) }}</span
          ><small v-if="input.audio.meterObservedAt">{{
            model.age(input.audio.meterObservedAt)
          }}</small>
        </div>
      </div>
      <ObsAudioAdvanced v-if="!compact" :input="input" />
    </div>
  </section>
</template>
