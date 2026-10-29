<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
import ObsAudioMixer from "./ObsAudioMixer.vue";
import ObsOutputControls from "./ObsOutputControls.vue";
const model = useObsProduction();
</script>
<template>
  <section class="cf-production-desk" aria-label="Live production desk">
    <header class="cf-production-heading">
      <div>
        <h2>Live desk</h2>
        <p>
          See the current program, prepare the next scene and control what
          viewers hear.
        </p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.connected || !model.supported || model.ui.pending"
        @click="model.refreshFrames()"
      >
        Refresh monitors
      </button>
    </header>
    <p v-if="!model.connected || !model.supported" class="cf-production-empty">
      Connect OBS in Setup to load your scenes, audio and production controls.
    </p>
    <div class="cf-production-monitors">
      <figure class="cf-production-monitor is-program">
        <figcaption>
          <strong>Program</strong><span>Current OBS output</span>
        </figcaption>
        <img
          v-if="model.currentFrames && model.ui.programFrame"
          :src="model.ui.programFrame.dataUrl"
          alt="Sampled OBS program scene"
        />
        <div v-else class="cf-production-monitor-empty">
          The program image appears after OBS connects.
        </div>
        <p>{{ model.age(model.ui.programFrame?.observedAt) }}</p>
      </figure>
      <figure class="cf-production-monitor">
        <figcaption>
          <strong>Preview</strong><span>Next scene in Studio Mode</span>
        </figcaption>
        <img
          v-if="model.currentFrames && model.ui.previewFrame"
          :src="model.ui.previewFrame.dataUrl"
          alt="Sampled OBS preview scene"
        />
        <div v-else class="cf-production-monitor-empty">
          Enable Studio Mode and select a preview scene.
        </div>
        <p>{{ model.age(model.ui.previewFrame?.observedAt) }}</p>
      </figure>
    </div>
    <p class="cf-production-sampling">
      Sampled images · refreshed every 5 seconds while this desk is visible.
      These monitors do not play audio or provide a continuous video feed.
    </p>
    <div class="cf-production-switcher">
      <label class="cf-project-repository-toggle"
        ><input
          type="checkbox"
          :checked="model.ui.snapshot?.studioMode ?? false"
          :disabled="!model.canChange || !model.supports('studio-mode')"
          @change="model.studioMode(!model.ui.snapshot?.studioMode)"
        /><span>Studio Mode</span></label
      >
      <label class="cf-field"
        ><span>Next scene</span
        ><select
          v-model="model.ui.previewScene"
          :disabled="!model.canChange || !model.ui.snapshot?.studioMode"
        >
          <option value="">Choose a scene</option>
          <option
            v-for="scene in model.scenes"
            :key="scene.id"
            :value="scene.id"
          >
            {{ scene.name }}
          </option>
        </select></label
      >
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.canChange ||
          !model.ui.previewScene ||
          !model.supports('preview-scene')
        "
        @click="model.preview()"
      >
        Load preview
      </button>
      <label class="cf-field"
        ><span>Transition</span
        ><select v-model="model.ui.transition">
          <option value="">Choose a transition</option>
          <option
            v-for="transition in model.ui.snapshot?.transitions"
            :key="transition.name"
            :value="transition.name"
          >
            {{ transition.name }}
          </option>
        </select></label
      >
      <label class="cf-field cf-production-duration"
        ><span>Duration (ms)</span
        ><input
          v-model.number="model.ui.duration"
          type="number"
          min="50"
          max="20000"
          step="50"
      /></label>
      <button
        type="button"
        class="cf-btn cf-btn-primary"
        :disabled="
          !model.canChange ||
          !model.ui.snapshot?.studioMode ||
          !model.ui.transition ||
          !model.supports('transition')
        "
        @click="model.take()"
      >
        Take preview live
      </button>
    </div>
    <p>
      Changing a shared source can affect the program immediately, even while
      its scene is in preview.
    </p>
    <ObsAudioMixer compact />
    <ObsOutputControls />
  </section>
</template>
