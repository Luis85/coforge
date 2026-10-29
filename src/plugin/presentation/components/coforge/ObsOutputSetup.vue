<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
const model = useObsProduction();
</script>
<template>
  <section
    class="cf-production-section"
    aria-label="OBS video and output setup"
  >
    <h3>Video &amp; output</h3>
    <p>
      Changes apply to the connected OBS installation. Stop active outputs
      before changing video or stream settings.
    </p>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Output preset</span
        ><select v-model="model.ui.outputPreset">
          <option value="balanced">
            Balanced · 4500 kbps video / 160 kbps audio
          </option>
          <option value="quality">
            Quality · 6000 kbps video / 192 kbps audio
          </option>
        </select></label
      ><label class="cf-field"
        ><span>Replay length (seconds)</span
        ><input
          v-model.number="model.ui.replaySeconds"
          type="number"
          min="5"
          max="120" /></label
      ><label class="cf-project-repository-toggle"
        ><input v-model="model.ui.replayEnabled" type="checkbox" /><span
          >Enable replay buffer</span
        ></label
      >
    </div>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="
        !model.canChange ||
        !model.supports('output-preset') ||
        Boolean(model.ui.snapshot?.broadcast.active) ||
        Boolean(model.ui.snapshot?.recording?.active)
      "
      @click="model.saveOutputPreset()"
    >
      Apply output preset
    </button>
    <p>
      Presets use OBS Simple Output and MKV recording, retaining the configured
      encoder. Restart OBS once after saving, then reconnect and test
      recording/replay availability.
    </p>
    <section
      v-if="model.outputRestartRequired"
      class="cf-production-review"
      aria-label="Review OBS output restart"
    >
      <h3>Restart OBS before rehearsal</h3>
      <p>
        The preset is saved, but OBS may still be using its previous output
        handlers. Restart OBS once, reconnect here and review its output setup.
        This confirmation records your review; CoForge cannot prove the
        application restarted.
      </p>
      <label class="cf-project-repository-toggle"
        ><input v-model="model.ui.restartReviewed" type="checkbox" /><span
          >I restarted OBS and reviewed output setup</span
        ></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.ui.restartReviewed || !model.canChange"
        @click="model.acknowledgeRestart()"
      >
        Confirm output restart review
      </button>
    </section>
    <div class="cf-production-transform-fields">
      <label class="cf-field"
        ><span>Canvas width</span
        ><input
          v-model.number="model.ui.video.baseWidth"
          type="number"
          min="1"
          max="4096" /></label
      ><label class="cf-field"
        ><span>Canvas height</span
        ><input
          v-model.number="model.ui.video.baseHeight"
          type="number"
          min="1"
          max="4096"
      /></label>
      <label class="cf-field"
        ><span>Output width</span
        ><input
          v-model.number="model.ui.video.outputWidth"
          type="number"
          min="1"
          max="4096" /></label
      ><label class="cf-field"
        ><span>Output height</span
        ><input
          v-model.number="model.ui.video.outputHeight"
          type="number"
          min="1"
          max="4096"
      /></label>
      <label class="cf-field"
        ><span>Frames per second</span
        ><input
          v-model.number="model.ui.video.fpsNumerator"
          type="number"
          min="1"
          max="240"
      /></label>
    </div>
    <button
      type="button"
      class="cf-btn cf-btn-secondary"
      :disabled="
        !model.canChange ||
        !model.supports('video-settings') ||
        Boolean(model.ui.snapshot?.broadcast.active) ||
        Boolean(model.ui.snapshot?.recording?.active)
      "
      @click="model.saveVideo()"
    >
      Apply video settings
    </button>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Recording folder on the OBS computer</span
        ><input v-model="model.ui.recordDirectory" maxlength="1000" /><small>{{
          model.ui.snapshot?.recordDirectory
            ? `Current folder: ${model.ui.snapshot.recordDirectory}`
            : "Refresh production state to read the current folder."
        }}</small></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.canChange ||
          !model.supports('record-directory') ||
          !model.ui.recordDirectory
        "
        @click="model.saveDirectory()"
      >
        Save recording folder
      </button>
    </div>
    <details class="cf-production-advanced">
      <summary>Stream destination</summary>
      <p>
        Enter a stream key only when setting up or replacing the destination.
        CoForge never reads the existing key back.
      </p>
      <p v-if="model.ui.snapshot?.destination" role="status">
        {{ model.ui.snapshot.destination.service }} destination accepted by OBS,
        delivery unverified. Rehearse and review the destination before
        broadcasting.
      </p>
      <div class="cf-production-fields">
        <label class="cf-field"
          ><span>Streaming service</span
          ><select v-model="model.ui.outputService">
            <option value="Twitch">Twitch</option>
            <option value="Custom">Custom RTMP</option>
          </select></label
        ><label class="cf-field"
          ><span>Ingest server</span
          ><input v-model="model.ui.outputServer" maxlength="1000" /><small
            >Use auto for Twitch, or the RTMP server supplied by your
            service.</small
          ></label
        ><label class="cf-field"
          ><span>Stream key</span
          ><input
            v-model="model.ui.outputSecret"
            type="password"
            autocomplete="off"
            maxlength="1000"
        /></label>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.canChange ||
          !model.supports('stream-service') ||
          !model.ui.outputSecret ||
          Boolean(model.ui.snapshot?.broadcast.active)
        "
        @click="model.saveDestination()"
      >
        Save destination securely
      </button>
    </details>
  </section>
</template>
