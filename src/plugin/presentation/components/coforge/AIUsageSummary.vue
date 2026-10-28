<script setup lang="ts">
import {
  formatTokens,
  type tokenSummary,
} from "../../../features/coforge/domain/ai-usage";
defineProps<{ summary: ReturnType<typeof tokenSummary> }>();
</script>
<template>
  <section class="cf-ai-token-usage" aria-label="Token usage">
    <h2>Token usage</h2>
    <dl class="cf-ai-token-totals">
      <div>
        <dt>Uncached input tokens</dt>
        <dd>
          <strong>{{ formatTokens(summary.inputTokens) }}</strong>
          <small
            >{{ summary.inputTasks }} / {{ summary.realTasks }} tasks
            reported</small
          >
        </dd>
      </div>
      <div>
        <dt>Output tokens</dt>
        <dd>
          <strong>{{ formatTokens(summary.outputTokens) }}</strong>
          <small
            >{{ summary.outputTasks }} / {{ summary.realTasks }} tasks
            reported</small
          >
        </dd>
      </div>
      <div>
        <dt>Cache-read input tokens</dt>
        <dd>
          <strong>{{ formatTokens(summary.cacheReadInputTokens) }}</strong>
          <small
            >{{ summary.cacheReadTasks }} / {{ summary.realTasks }} tasks
            reported</small
          >
        </dd>
      </div>
      <div>
        <dt>Cache-write input tokens</dt>
        <dd>
          <strong>{{ formatTokens(summary.cacheCreationInputTokens) }}</strong>
          <small
            >{{ summary.cacheCreationTasks }} / {{ summary.realTasks }} tasks
            reported</small
          >
        </dd>
      </div>
    </dl>
    <p class="cf-muted">
      Total input including cache:
      <strong>{{ formatTokens(summary.totalInputTokens) }}</strong> ·
      {{ summary.completeInputTasks }} / {{ summary.realTasks }} complete input
      reports.
    </p>
    <p class="cf-muted">
      Provider counters only. Uncached input and cache reads/writes are
      separate; inclusive input uses only tasks reporting all three. Missing
      counts stay unavailable, genuine zero stays zero. Simulations are
      excluded.
    </p>
  </section>
</template>
