<script setup lang="ts">
import type { useCouncilSelection } from '../../composables/coforge/council-selection';
defineProps<{ selection: ReturnType<typeof useCouncilSelection> }>();
</script>
<template>
  <section v-if="selection.selected || selection.issue" class="cf-council-recipients" aria-label="Selected Council recipients">
    <h3>{{ selection.selected?.name || 'Council unavailable' }}</h3>
    <p v-if="selection.issue" role="status" class="cf-inline-error">{{ selection.issue }}</p>
    <template v-else>
      <p>These CoWorkers receive your request in the configured rounds.</p>
      <ul class="cf-council-roster">
        <li v-for="member in selection.members" :key="member.id">
          <strong>{{ member.name }}</strong>
          <span>{{ member.role || 'Council member' }}</span>
          <small>{{ member.provider === 'demo' ? 'Simulation · no model call' : `${member.provider} · ${member.model}` }}</small>
        </li>
      </ul>
      <details>
        <summary>{{ selection.rounds.length }} discussion rounds · view order and participants</summary>
        <ol>
          <li v-for="round in selection.rounds" :key="round.id">
            <strong>{{ round.name }}</strong> · {{ round.promptOrder === 'fan-out' ? 'Concurrent' : 'Sequential' }}
            <span> · {{ round.participants.map(id => selection.members.find(member => member.id === id)?.name ?? id).join(', ') }}</span>
          </li>
        </ol>
      </details>
      <p class="cf-settings-help">The review captures exact instructions and recipients. Changes to definitions require a fresh review.</p>
    </template>
  </section>
</template>
