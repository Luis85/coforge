<script setup lang="ts">
import type { CouncilRound } from "../../../features/coforge/domain/council-definitions";
defineProps<{ rounds: readonly CouncilRound[] }>();
</script>
<template>
  <section aria-label="Round prompt order">
    <h4>Round prompt order</h4>
    <ol>
      <li v-for="round in rounds" :key="round.id">
        {{ round.name }} ·
        <strong>{{
          round.promptOrder === "fan-out"
            ? "Fan out (concurrent)"
            : "Round robin (sequential)"
        }}</strong>
        · {{ round.participants.length }}
        {{ round.participants.length === 1 ? "member" : "members" }}
      </li>
    </ol>
    <p>
      Each round waits for the preceding round's persisted outcomes. Members
      receive only the captured source and selected earlier collections.
    </p>
  </section>
</template>
