<script setup lang="ts">
import { useObsProduction } from "../../composables/coforge/use-obs-production";
const model = useObsProduction();
</script>
<template>
  <section
    class="cf-production-section"
    aria-label="Saved recordings and replays"
  >
    <h3>Saved recordings &amp; replays</h3>
    <p>
      Confirmed OBS file references survive CoForge reloads. Paths belong to the
      OBS computer; a reference does not verify the file still exists.
    </p>
    <p v-if="!model.outputFiles.length">
      Stop a recording or save a replay to retain its confirmed file reference
      here.
    </p>
    <ol class="cf-production-step-list">
      <li v-for="file in model.outputFiles" :key="file.id">
        <strong>{{
          file.kind === "recording" ? "Recording" : "Replay"
        }}</strong>
        · {{ file.at }}
        <p>{{ file.path }}</p>
        <small
          >{{
            file.broadcastActive ? "During a broadcast" : "Off-air recording"
          }}
          · OBS timecode {{ file.timecode || "unavailable" }}</small
        >
      </li>
    </ol>
  </section>
</template>
