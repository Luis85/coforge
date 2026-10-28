<script setup lang="ts">
defineProps<{
  boards: Array<{
    name: string;
    unit: string;
    entries: Array<{ name: string; value: number }>;
  }>;
  metric: (value: number, unit: string) => string;
}>();
</script>
<template>
  <div class="cf-stream-leaders">
    <section v-for="board in boards" :key="board.name">
      <h2>{{ board.name }}</h2>
      <p v-if="!board.entries.length" class="cf-stream-empty">
        Your first screened contribution can start this ranking.
      </p>
      <ol>
        <li
          v-for="(entry, index) in board.entries"
          :key="`${index}-${entry.name}`"
        >
          <span class="cf-stream-rank" aria-hidden="true">{{ index + 1 }}</span>
          <div>
            <strong>{{ entry.name }}</strong
            ><span>{{ metric(entry.value, board.unit) }}</span>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
