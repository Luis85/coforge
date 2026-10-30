<script setup lang="ts">
import { useObsShow } from "../../composables/coforge/use-obs-show";
const model = useObsShow();
</script>
<template>
  <section
    v-if="model.cue"
    class="cf-production-section"
    aria-label="Cue actions"
  >
    <h3>Cue actions</h3>
    <p>For music, choose an existing OBS media source. Combine playback, mute and volume actions with scene changes. Sources and audio routing are configured in OBS.</p>
    <p v-if="!model.cue.steps.length">
      Add the scene, audio or recording actions for this segment. Creating a
      segment does not change OBS.
    </p>
    <ol class="cf-production-step-list">
      <li v-for="(step, index) in model.cue.steps" :key="index">
        <span>{{ model.describe(step) }}</span>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="index === 0"
            :aria-label="`Move action ${index + 1} up`"
            @click="model.moveStep(index, -1)"
          >
            Move up</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :disabled="index === model.cue.steps.length - 1"
            :aria-label="`Move action ${index + 1} down`"
            @click="model.moveStep(index, 1)"
          >
            Move down</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            :aria-label="`Remove action ${index + 1}`"
            @click="model.removeStep(index)"
          >
            Remove
          </button>
        </div>
      </li>
    </ol>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Action to add</span
        ><select v-model="model.ui.stepKind">
          <option value="scene">Switch scene</option>
          <option value="transition">Preview and transition</option>
          <option value="mute">Mute / unmute input</option>
          <option value="volume">Set volume</option>
          <option value="record">Recording action</option>
          <option value="replay-save">Save replay</option>
          <option value="media">Music / media playback</option>
          <option value="source-visible">Show / hide source</option>
          <option value="overlay">Refresh public overlay</option>
          <option value="marker">Add moment marker</option>
        </select></label
      >
      <label
        v-if="
          model.ui.stepKind === 'scene' ||
          model.ui.stepKind === 'transition' ||
          model.ui.stepKind === 'source-visible'
        "
        class="cf-field"
        ><span>Target scene</span
        ><select v-model="model.ui.sceneId">
          <option value="">Choose a scene</option>
          <option
            v-for="scene in model.production.scenes"
            :key="scene.id"
            :value="scene.id"
          >
            {{ scene.name }}
          </option>
        </select></label
      >
      <label
        v-if="
          model.ui.stepKind === 'mute' ||
          model.ui.stepKind === 'volume' ||
          model.ui.stepKind === 'media'
        "
        class="cf-field"
        ><span>Target input</span
        ><select v-model="model.ui.inputId">
          <option value="">Choose an input</option>
          <option
            v-for="input in model.targetInputs"
            :key="input.id"
            :value="input.id"
          >
            {{ input.name }}
          </option>
        </select></label
      >
      <label
        v-if="model.ui.stepKind === 'mute'"
        class="cf-project-repository-toggle"
        ><input v-model="model.ui.muted" type="checkbox" /><span
          >Mute this input</span
        ></label
      >
      <label v-if="model.ui.stepKind === 'volume'" class="cf-field"
        ><span>Target volume (dB)</span
        ><input
          v-model.number="model.ui.volumeDb"
          type="number"
          min="-100"
          max="26"
      /></label>
      <label v-if="model.ui.stepKind === 'overlay'" class="cf-field"
        ><span>Approved public overlay</span
        ><select v-model="model.ui.overlayId">
          <option value="">Choose an approved overlay</option>
          <option
            v-for="overlay in model.overlays"
            :key="overlay.id"
            :value="overlay.id"
          >
            {{ overlay.name }}
          </option>
        </select></label
      >
      <label v-if="model.ui.stepKind === 'marker'" class="cf-field"
        ><span>Marker label</span
        ><input v-model="model.ui.marker" maxlength="150"
      /></label>
      <label v-if="model.ui.stepKind === 'record'" class="cf-field"
        ><span>Recording action</span
        ><select v-model="model.ui.recordAction">
          <option value="start">Start</option>
          <option value="stop">Stop</option>
          <option value="pause">Pause</option>
          <option value="resume">Resume</option>
        </select></label
      >
      <label v-if="model.ui.stepKind === 'media'" class="cf-field"
        ><span>Media action</span
        ><select v-model="model.ui.mediaAction">
          <option value="play">Play</option>
          <option value="pause">Pause</option>
          <option value="stop">Stop</option>
          <option value="restart">Restart</option>
          <option value="next">Next</option>
          <option value="previous">Previous</option>
        </select></label
      >
      <label v-if="model.ui.stepKind === 'source-visible'" class="cf-field"
        ><span>Scene item ID</span
        ><input v-model.number="model.ui.itemId" type="number" min="0" /><small
          >Use the item ID inspected in Sources &amp; layouts.</small
        ></label
      >
      <label
        v-if="model.ui.stepKind === 'source-visible'"
        class="cf-project-repository-toggle"
        ><input v-model="model.ui.visible" type="checkbox" /><span
          >Show this source</span
        ></label
      >
      <label v-if="model.ui.stepKind === 'transition'" class="cf-field"
        ><span>Cue transition</span
        ><select v-model="model.production.ui.transition">
          <option
            v-for="transition in model.production.ui.snapshot?.transitions"
            :key="transition.name"
            :value="transition.name"
          >
            {{ transition.name }}
          </option>
        </select></label
      >
      <label v-if="model.ui.stepKind === 'transition'" class="cf-field"
        ><span>Cue transition duration (ms)</span
        ><input
          v-model.number="model.production.ui.duration"
          type="number"
          min="50"
          max="20000"
      /></label>
    </div>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="model.cue.steps.length >= 30"
      @click="model.addStep()"
    >
      Add action to cue
    </button>
  </section>
</template>
