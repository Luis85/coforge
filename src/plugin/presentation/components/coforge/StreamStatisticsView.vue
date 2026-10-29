<script setup lang="ts">
import { useStreamStatistics } from "../../composables/coforge/use-stream-statistics";
import StatisticsChart from "./StatisticsChart.vue";
const model = useStreamStatistics();
</script>
<template>
  <div class="cf-statistics-page">
    <header class="cf-page-heading">
      <div>
        <h1>Stream statistics</h1>
        <p>
          Understand audience and participation, then compare the evidence from
          earlier shows.
        </p>
      </div>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.loading || (!model.supported && !model.example)"
          @click="model.refresh()"
        >
          Refresh statistics
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="
            !model.histories.length ||
            model.loading ||
            model.example ||
            !model.supported
          "
          @click="model.export()"
        >
          Export selected stream JSON
        </button>
      </div>
    </header>
    <p v-if="model.example" class="cf-statistics-example" role="status">
      Example statistics · synthetic data, not channel observations. Nothing is
      saved.
    </p>
    <button
      v-if="model.example"
      type="button"
      class="cf-btn cf-btn-secondary"
      @click="model.exitExample()"
    >
      Exit example
    </button>
    <p v-if="model.error" role="alert" class="cf-inline-error">
      {{ model.error }}
    </p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
    <template v-if="model.entries.length">
      <div class="cf-statistics-controls">
        <label class="cf-field"
          ><span>Stream</span
          ><select
            v-model="model.store.statisticsStream"
            aria-label="Statistics stream"
          >
            <option
              v-for="stream in model.entries"
              :key="stream.id"
              :value="stream.id"
            >
              {{ model.label(stream) }}
            </option>
          </select></label
        >
        <label class="cf-field"
          ><span>Metric</span
          ><select
            v-model="model.store.statisticsMetric"
            aria-label="Statistics metric"
          >
            <optgroup v-for="group in model.groups" :key="group" :label="group">
              <option
                v-for="metric in model.metrics.filter(
                  (item) => item.group === group,
                )"
                :key="metric.id"
                :value="metric.id"
              >
                {{ metric.label }}
              </option>
            </optgroup>
          </select></label
        >
      </div>
      <fieldset class="cf-statistics-comparisons">
        <legend>Compare earlier streams</legend>
        <label v-if="model.candidates.length" class="cf-field"
          ><span class="cf-sr-only">Add comparison stream</span
          ><select
            aria-label="Add comparison stream"
            :disabled="model.store.statisticsComparisons.length >= 3"
            @change="model.addComparison"
          >
            <option value="">Add an earlier stream…</option>
            <option
              v-for="stream in model.candidates.filter(
                (item) => !model.store.statisticsComparisons.includes(item.id),
              )"
              :key="stream.id"
              :value="stream.id"
            >
              {{ model.label(stream) }}
            </option>
          </select></label
        >
        <p v-else>No earlier completed streams on this channel.</p>
        <small
          >Up to three earlier streams, aligned by elapsed time. Shorter
          recordings are not extended.</small
        >
      </fieldset>
      <p v-for="failed in model.failedComparisons" :key="failed.id">
        {{ failed.date ? model.streamDate(failed.date) : "Earlier recording" }}
        is unavailable.
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.removeComparison(failed.id)"
        >
          Remove unavailable comparison
        </button>
      </p>
      <div class="cf-statistics-selection">
        <h2>{{ model.title }}</h2>
        <p v-if="model.selected">
          {{ model.streamDate(model.selected.startedAt) }} ·
          {{ model.selected.endedAt ? "Finished recording" : "Recording" }} ·
          {{ model.selected.samples }} minute samples
        </p>
      </div>
      <div v-if="model.loading" class="cf-statistics-loading" role="status">
        Loading recorded observations…
      </div>
      <template v-else-if="model.histories.length">
        <dl
          class="cf-statistics-overview"
          aria-label="Selected recording overview"
        >
          <div>
            <dt>Mean observed viewers</dt>
            <dd>{{ model.format(model.summaries[0]?.meanViewers, 1) }}</dd>
          </div>
          <div>
            <dt>Peak observed viewers</dt>
            <dd>{{ model.format(model.summaries[0]?.peakViewers) }}</dd>
          </div>
          <div>
            <dt>Observed Twitch messages</dt>
            <dd>{{ model.format(model.summaries[0]?.chatMessages) }}</dd>
          </div>
          <div>
            <dt>Missing recorded minutes</dt>
            <dd>{{ model.format(model.summaries[0]?.missingMinutes, 1) }}</dd>
          </div>
        </dl>
        <p class="cf-statistics-coverage" aria-label="Selected metric coverage">
          <strong>{{ model.metric.label }}</strong> ·
          {{
            (model.series[0]?.sampled ?? 0) - (model.series[0]?.missing ?? 0)
          }}
          available · {{ model.series[0]?.missing ?? 0 }} unavailable
          observations. Gaps stay visible; unavailable values are not zero.
        </p>
        <ul class="cf-statistics-legend" aria-label="Displayed streams">
          <li v-for="(history, index) in model.histories" :key="history.id">
            <span :class="`cf-series-mark cf-stat-series-${index}`" /><span
              >{{ index === 0 ? "Selected" : "Earlier" }} ·
              {{ model.streamDate(history.startedAt) }}</span
            ><button
              v-if="index > 0"
              type="button"
              class="cf-btn cf-btn-ghost"
              :aria-label="`Remove comparison ${model.streamDate(history.startedAt)}`"
              @click="model.removeComparison(history.id)"
            >
              Remove
            </button>
          </li>
        </ul>
        <StatisticsChart :series="model.series" :metric="model.metric" />
        <p class="cf-settings-help">
          {{ model.series[0]?.sampled ?? 0 }} observations for this metric;
          {{ model.series[0]?.missing ?? 0 }} unavailable. Growth starts at the
          first valid total. Activity counts cover each recorded interval;
          community balances are workspace totals.
        </p>
        <section
          class="cf-statistics-comparison-table"
          aria-label="Stream comparison"
        >
          <h2>Compare the recordings</h2>
          <div
            class="cf-statistics-table-scroll"
            tabindex="0"
            role="region"
            aria-label="Comparison metrics table"
          >
            <table>
              <caption>
                Observed values, not Twitch’s official channel analytics.
                Missing coverage can affect comparisons.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th
                    v-for="summary in model.summaries"
                    :key="summary.id"
                    scope="col"
                  >
                    {{ summary.date }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in model.comparisonRows" :key="row.key">
                  <th scope="row">{{ row.label }}</th>
                  <td v-for="summary in model.summaries" :key="summary.id">
                    {{ model.format(summary[row.key], row.decimals) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <details class="cf-statistics-samples">
          <summary>Recorded samples for selected stream</summary>
          <div
            class="cf-statistics-table-scroll"
            tabindex="0"
            role="region"
            aria-label="Recorded samples table"
          >
            <table>
              <caption>
                Exact
                {{
                  model.metric.label.toLowerCase()
                }}
                observations ·
                {{
                  model.metric.unit
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Elapsed time</th>
                  <th scope="col">Value</th>
                  <th scope="col">Missing minutes before sample</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="point in model.rows" :key="point.at">
                  <td>{{ model.elapsed(point.minute) }}</td>
                  <td>
                    {{ model.format(point.value, model.metric.decimals) }}
                  </td>
                  <td>{{ model.format(point.gapSeconds / 60, 1) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="cf-statistics-pagination">
            <button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="model.store.statisticsPage === 0"
              @click="model.previousPage()"
            >
              Previous samples</button
            ><span
              >{{ model.rowCount ? model.store.statisticsPage * 50 + 1 : 0 }}–{{
                Math.min((model.store.statisticsPage + 1) * 50, model.rowCount)
              }}
              of {{ model.rowCount }}</span
            ><button
              type="button"
              class="cf-btn cf-btn-secondary"
              :disabled="
                (model.store.statisticsPage + 1) * 50 >= model.rowCount
              "
              @click="model.nextPage()"
            >
              Next samples
            </button>
          </div>
        </details>
      </template>
    </template>
    <section
      v-else-if="!model.loading"
      class="cf-statistics-empty"
      aria-label="No stream statistics"
    >
      <h2>No recorded streams yet</h2>
      <p>
        Histories appear after CoForge observes a live stream. Connect OBS and
        Twitch in Stream studio to begin.
      </p>
      <div class="cf-settings-actions">
        <button
          type="button"
          class="cf-btn cf-btn-primary"
          @click="model.store.navigate('broadcast')"
        >
          Open Stream studio</button
        ><button
          v-if="model.canPreview"
          type="button"
          class="cf-btn cf-btn-secondary"
          @click="model.preview()"
        >
          Explore sample statistics
        </button>
      </div>
    </section>
  </div>
</template>
