<script setup lang="ts">
import type { ObsProductionInput } from "../../../features/coforge/domain/obs-production";
import { useObsAudioAdvanced } from "../../composables/coforge/use-obs-audio-advanced";
const props = defineProps<{ input: ObsProductionInput }>();
const model = useObsAudioAdvanced(() => props.input);
</script>
<template>
  <details class="cf-production-advanced">
    <summary>Monitoring, sync and recording tracks</summary>
    <div class="cf-production-fields">
      <label class="cf-field"
        ><span>Monitoring</span
        ><select v-model="model.monitor">
          <option value="OBS_MONITORING_TYPE_NONE">Monitor off</option>
          <option value="OBS_MONITORING_TYPE_MONITOR_ONLY">
            Monitor only · muted in output
          </option>
          <option value="OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT">
            Monitor and output
          </option>
        </select></label
      >
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canMonitor"
        @click="model.saveMonitor()"
      >
        Apply monitoring
      </button>
      <label class="cf-field"
        ><span>Audio sync offset (ms)</span
        ><input
          v-model.number="model.offsetMs"
          type="number"
          min="-950"
          max="20000"
      /></label>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canSync"
        @click="model.saveSync()"
      >
        Apply sync offset
      </button>
    </div>
    <p>
      Monitoring plays through OBS’s configured monitoring device. Avoid feeding
      it back into captured desktop audio.
    </p>
    <fieldset>
      <legend>Recording tracks</legend>
      <label
        v-for="track in model.tracks"
        :key="track.id"
        class="cf-project-repository-toggle"
        ><input v-model="track.enabled" type="checkbox" /><span
          >Track {{ track.id }}</span
        ></label
      ><button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="!model.canTracks"
        @click="model.saveTracks()"
      >
        Apply track routing
      </button>
    </fieldset>
  </details>
</template>
