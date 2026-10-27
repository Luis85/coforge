<script setup lang="ts">
import type { StatisticsSeries } from "../../../features/coforge/domain/stream-statistics";
import type { StatisticsMetric } from "../../../features/coforge/domain/statistics-metrics";
import { useStatisticsChart } from "../../composables/coforge/use-statistics-chart";
const props = defineProps<{ series: readonly StatisticsSeries[]; metric: StatisticsMetric }>();
const model = useStatisticsChart(props);
</script>
<template>
  <figure :ref="model.bind" class="cf-statistics-chart" aria-label="Metric timeline">
    <template v-if="model.geometry.valid">
      <svg
        :viewBox="`0 0 ${model.geometry.width} ${model.geometry.height}`"
        role="img"
        :aria-labelledby="model.titleId"
        @pointermove="model.inspect"
      >
        <title :id="model.titleId">{{ metric.label }} over elapsed stream time</title>
        <desc>
          Solid line is the selected stream; dashed lines are earlier streams. Missing observations break the lines.
          Exact values are available below.
        </desc>
        <g class="cf-chart-grid">
          <line
            v-for="tick in model.geometry.yTicks"
            :key="tick.value"
            :x1="model.geometry.left"
            :x2="model.geometry.right"
            :y1="tick.position"
            :y2="tick.position"
          />
        </g>
        <g class="cf-chart-axis">
          <text
            v-for="tick in model.geometry.yTicks"
            :key="tick.value"
            :x="model.geometry.left - 10"
            :y="tick.position + 4"
            text-anchor="end"
          >
            {{ model.axis(tick.value, metric.decimals) }}
          </text>
          <text
            v-for="tick in model.geometry.xTicks"
            :key="tick.value"
            :x="tick.position"
            :y="model.geometry.bottom + 24"
            :text-anchor="tick.value === model.geometry.xMax ? 'end' : tick.value === 0 ? 'start' : 'middle'"
          >
            {{ model.format(tick.value, 1) }}
          </text>
        </g>
        <g v-for="(line, index) in model.geometry.lines" :key="line.id" :class="`cf-stat-series-${index}`">
          <path v-for="(path, segment) in line.paths" :key="segment" :d="path" class="cf-chart-line" />
          <circle
            v-for="(point, pointIndex) in line.isolated"
            :key="pointIndex"
            :cx="point.x"
            :cy="point.y"
            r="3"
            class="cf-chart-dot"
          />
        </g>
        <line
          :x1="model.cursorX"
          :x2="model.cursorX"
          :y1="model.geometry.top"
          :y2="model.geometry.bottom"
          class="cf-chart-cursor"
        />
        <g v-for="(item, index) in model.inspected" :key="item.id" :class="`cf-stat-series-${index}`">
          <circle
            v-if="item.point && item.point.value !== null"
            :cx="model.geometry.x(item.point.minute)"
            :cy="model.geometry.y(item.point.value)"
            r="4"
            class="cf-chart-dot"
          />
        </g>
      </svg>
      <figcaption>
        {{ metric.unit }} · elapsed minutes from go-live. Gaps are unrecorded or unavailable observations.
      </figcaption>
      <label class="cf-chart-inspector"
        ><span
          >Inspect elapsed minute <strong>{{ model.elapsed(model.store.statisticsCursor) }}</strong></span
        >
        <input
          v-model.number="model.store.statisticsCursor"
          type="range"
          min="0"
          :max="model.geometry.xMax"
          step="0.1"
          aria-label="Inspect elapsed minute"
          :aria-valuetext="model.cursorText"
      /></label>
      <div class="cf-statistics-table-scroll" tabindex="0" role="region" aria-label="Inspected values table">
        <table class="cf-chart-readout">
          <caption>
            Nearest recorded values · no interpolation
          </caption>
          <thead>
            <tr>
              <th scope="col">Stream</th>
              <th scope="col">Recorded elapsed time</th>
              <th scope="col">{{ metric.unit }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in model.inspected" :key="item.id">
              <th scope="row"><span :class="`cf-series-mark cf-stat-series-${index}`" />{{ item.date }}</th>
              <td>{{ item.point ? model.elapsed(item.point.minute) : "No nearby observation" }}</td>
              <td>{{ model.format(item.point?.value, metric.decimals) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="model.geometry.reduced" class="cf-settings-help">
        Long timelines are reduced for display with peaks retained. The sample table keeps the exact recorded values.
      </p>
    </template>
    <div v-else class="cf-statistics-empty">
      <h3>No observations for this metric</h3>
      <p>Select another metric or stream. Missing values have not been replaced with zero.</p>
    </div>
  </figure>
</template>
