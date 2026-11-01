<script setup lang="ts">
import type { Idea } from '../../../features/coforge/domain/types';
import { useIdeaAICosts } from '../../composables/coforge/use-idea-ai-costs';
import AIUsageSummary from './AIUsageSummary.vue';
const props = defineProps<{ idea: Idea }>();
const model = useIdeaAICosts(props);
</script>
<template>
  <section class="cf-idea-costs" aria-label="Request AI costs">
    <div class="cf-session-peek-heading"><h3>AI costs</h3><button v-if="model.available" type="button" class="cf-btn cf-btn-secondary cf-idea-small-button" :disabled="model.refreshing || model.loading" @click="model.refresh()">{{ model.refreshing ? 'Refreshing…' : 'Refresh cost history' }}</button></div>
    <p class="cf-idea-help">Retained usage for this request and project, including failed and cancelled attempts. Provider USD amounts are usage reports, not an invoice.</p>
    <p v-if="!model.available" class="cf-idea-help">AI cost history is available in Obsidian. No cost estimate is substituted here.</p>
    <template v-else>
      <p v-if="model.loading" class="cf-idea-help" role="status">Loading retained cost history…</p>
      <p v-if="model.failed" class="cf-inline-error" role="alert">Cost history is unavailable. Refresh this tab to check the retained ledger again.</p>
      <template v-if="model.count">
        <dl class="cf-idea-cost-summary" aria-label="Request cost coverage">
          <div><dt>Known subtotal · USD</dt><dd>{{ model.knownSubtotal }}</dd></div>
          <div><dt>Cost coverage</dt><dd>{{ model.knownCount }} of {{ model.usage.realTasks }} provider tasks have recorded USD amounts.</dd></div>
          <div><dt>Provider reported / manual fallback</dt><dd>{{ model.summary.reported }} / {{ model.summary.manual }}</dd></div>
          <div><dt>Unavailable / pending</dt><dd>{{ model.summary.missing }} / {{ model.summary.pending }}</dd></div>
          <div><dt>Simulations / not started</dt><dd>{{ model.summary.simulations }} / {{ model.summary.notStarted }}</dd></div>
        </dl>
        <p class="cf-idea-help">Unavailable amounts are not zero. Costs are counted once per retained task; native assistant observations do not add separate charges here.</p>
        <AIUsageSummary :summary="model.usage" />
        <h4>Recorded attempts · {{ model.count }}</h4>
        <ol class="cf-idea-cost-attempts">
          <li v-for="row in model.rows" :key="row.id"><details class="cf-idea-evidence">
            <summary><span><strong>{{ row.stepLabel }}</strong><small>{{ row.providerLabel }} · {{ row.modelLabel }} · {{ row.status }}</small></span><span><strong>{{ row.cost }}</strong><small>{{ row.source }}</small></span></summary>
            <dl class="cf-idea-cost-detail">
              <div><dt>Captured run</dt><dd><code>{{ row.runLabel }}</code></dd></div><div><dt>Captured attempt</dt><dd><code>{{ row.attemptLabel }}</code></dd></div>
              <div><dt>Started</dt><dd><time :datetime="row.startedAt">{{ model.date(row.startedAt) }}</time></dd></div>
              <div v-if="row.finishedAt"><dt>Finished</dt><dd><time :datetime="row.finishedAt">{{ model.date(row.finishedAt) }}</time></dd></div>
              <div><dt>Uncached input tokens</dt><dd>{{ row.input }}</dd></div><div><dt>Output tokens</dt><dd>{{ row.output }}</dd></div>
              <div><dt>Cache-read input tokens</dt><dd>{{ row.cacheRead }}</dd></div><div><dt>Cache-write input tokens</dt><dd>{{ row.cacheWrite }}</dd></div>
            </dl>
            <p v-if="row.manual" class="cf-idea-help">Manual fallback<template v-if="row.manualAt"> recorded <time :datetime="row.manualAt">{{ model.date(row.manualAt) }}</time></template>. {{ row.manualNote || 'No provenance note was supplied.' }}</p>
          </details></li>
        </ol>
        <button v-if="model.more" type="button" class="cf-btn cf-btn-ghost" @click="model.showMore()">Show 50 more attempts</button>
      </template>
      <p v-else-if="!model.loading && !model.failed" class="cf-idea-help">No retained cost records for this request. This does not establish zero spend.</p>
    </template>
  </section>
</template>
