<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
const model = useObsProduction();
</script>
<template>
  <section
    class="cf-production-outputs"
    aria-label="Recording and replay controls"
  >
    <h2>Recording &amp; replay</h2>
    <div class="cf-production-output-row">
      <div>
        <strong>Recording</strong
        ><span>{{
          model.ui.snapshot?.recording
            ? model.ui.snapshot.recording.active
              ? model.ui.snapshot.recording.paused
                ? "Paused"
                : `Recording · ${model.ui.snapshot.recording.timecode}`
              : "Stopped"
            : "Unavailable"
        }}</span>
      </div>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.canChange ||
            !model.supports('record-start') ||
            Boolean(model.ui.snapshot?.recording?.active)
          "
          @click="model.execute({ kind: 'record-start' })"
        >
          Start recording
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.canChange ||
            !model.ui.snapshot?.recording?.active ||
            !model.supports(
              model.ui.snapshot?.recording?.paused
                ? 'record-resume'
                : 'record-pause',
            )
          "
          @click="
            model.execute({
              kind: model.ui.snapshot?.recording?.paused
                ? 'record-resume'
                : 'record-pause',
            })
          "
        >
          {{
            model.ui.snapshot?.recording?.paused
              ? "Resume recording"
              : "Pause recording"
          }}
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.canChange ||
            !model.ui.snapshot?.recording?.active ||
            !model.supports('record-stop')
          "
          @click="model.execute({ kind: 'record-stop' })"
        >
          Stop recording
        </button>
      </div>
    </div>
    <div class="cf-production-output-row">
      <div>
        <strong>Replay buffer</strong
        ><span>{{
          model.ui.snapshot?.replayBuffer
            ? model.ui.snapshot.replayBuffer.active
              ? "Running"
              : "Stopped"
            : "Unavailable"
        }}</span>
      </div>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.canChange ||
            !model.supports(
              model.ui.snapshot?.replayBuffer?.active
                ? 'replay-stop'
                : 'replay-start',
            )
          "
          @click="
            model.execute({
              kind: model.ui.snapshot?.replayBuffer?.active
                ? 'replay-stop'
                : 'replay-start',
            })
          "
        >
          {{
            model.ui.snapshot?.replayBuffer?.active
              ? "Stop replay buffer"
              : "Start replay buffer"
          }}
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          :disabled="
            !model.canChange ||
            !model.ui.snapshot?.replayBuffer?.active ||
            !model.supports('replay-save')
          "
          @click="model.execute({ kind: 'replay-save' })"
        >
          Save replay
        </button>
      </div>
    </div>
    <div class="cf-production-output-row">
      <div>
        <strong>Virtual camera</strong
        ><span>{{
          model.ui.snapshot?.virtualCamera
            ? model.ui.snapshot.virtualCamera.active
              ? "Running"
              : "Stopped"
            : "Unavailable"
        }}</span>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="
          !model.canChange ||
          !model.supports(
            model.ui.snapshot?.virtualCamera?.active
              ? 'virtual-camera-stop'
              : 'virtual-camera-start',
          )
        "
        @click="
          model.execute({
            kind: model.ui.snapshot?.virtualCamera?.active
              ? 'virtual-camera-stop'
              : 'virtual-camera-start',
          })
        "
      >
        {{
          model.ui.snapshot?.virtualCamera?.active
            ? "Stop virtual camera"
            : "Start virtual camera"
        }}
      </button>
    </div>
    <p v-if="model.ui.snapshot?.lastRecording">
      Last recording: {{ model.ui.snapshot.lastRecording }}
    </p>
    <p v-if="model.ui.snapshot?.lastReplay">
      Last replay: {{ model.ui.snapshot.lastReplay }}
    </p>
    <p>
      Recording and broadcasting are independent. Pausing a recording does not
      pause the stream.
    </p>
  </section>
</template>
