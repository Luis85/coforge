<script setup lang="ts">
import { useAICosts } from "../../composables/coforge/use-ai-costs";
import AIUsageSummary from "./AIUsageSummary.vue";
const model = useAICosts();
</script>
<template>
  <section class="cf-ai-costs cf-ai-costs-page" aria-label="AI cost analytics">
    <header class="cf-page-heading">
      <div>
        <h1>AI costs</h1>
        <p>
          Usage in USD, by feature and task. Separate from your EUR payment
          ledger.
        </p>
      </div>
      <button
        type="button"
        class="cf-btn"
        :disabled="model.store.busy || !model.available"
        @click="model.refresh"
      >
        Refresh
      </button>
    </header>
    <p v-if="model.store.example" class="cf-notice">
      Example data · changes stay in this preview.
    </p>
    <p v-if="!model.available">
      AI cost history is available in Obsidian.
      <button
        v-if="model.canPreview"
        type="button"
        class="cf-btn"
        @click="model.preview"
      >
        Explore example costs
      </button>
    </p>
    <p v-if="model.store.error || model.store.state.error" role="alert">
      {{ model.store.error || model.store.state.error }}
    </p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
    <template v-if="model.available">
      <div class="cf-ai-filters">
        <label
          >Project<select v-model="model.store.project">
            <option value="">All projects</option>
            <option v-for="[id, name] in model.projects" :key="id" :value="id">
              {{ name }} · {{ id }}
            </option>
          </select></label
        ><label
          >Find a feature or task<input
            v-model="model.store.search"
            type="search"
            placeholder="Feature ID, title, stage or model" /></label
        ><label
          >Cost source<select v-model="model.store.source">
            <option value="">All sources</option>
            <option value="reported">Provider reported</option>
            <option value="manual">Manual</option>
            <option value="unavailable">Unavailable</option>
            <option value="simulation">Simulation</option>
          </select></label
        >
      </div>
      <p v-if="model.store.feature">
        <button type="button" class="cf-btn" @click="model.store.feature = ''">
          All features
        </button>
        Showing {{ model.store.feature }}
      </p>
      <div class="cf-ai-summary">
        <div>
          <small>Known usage · USD</small
          ><strong>{{ model.money(model.summary.nanos) }}</strong>
        </div>
        <div>
          <small>Provider reported</small
          ><strong>{{ model.summary.reported }} tasks</strong>
        </div>
        <div>
          <small>Manual fallback</small
          ><strong>{{ model.summary.manual }} tasks</strong>
        </div>
        <div>
          <small>Missing / pending</small
          ><strong
            >{{ model.summary.missing }} / {{ model.summary.pending }}</strong
          >
        </div>
      </div>
      <p class="cf-muted">
        Known totals exclude unavailable costs and
        {{ model.summary.simulations }} simulation tasks. Retries and failed
        attempts remain included. Herdr does not currently report token usage or
        costs.
      </p>
      <AIUsageSummary :summary="model.tokenTotals" />
      <p v-if="model.store.state.loading" role="status">
        Loading cost history…
      </p>
      <p v-else-if="!model.tasks.length">
        No tasks match this view. Real workflow runs and Herdr dispatches appear
        here as they are recorded.
      </p>
      <div v-if="model.features.length" class="cf-ai-features">
        <button
          v-for="feature in model.features.slice(0, 50)"
          :key="`${feature.project}/${feature.id}`"
          type="button"
          @click="model.store.feature = feature.id"
        >
          <span
            ><code>{{ feature.id }}</code> {{ feature.title
            }}<small
              >{{ feature.project }} · {{ feature.count }} attempts</small
            ></span
          ><strong
            >{{ feature.displayCost
            }}<small v-if="feature.summary.missing || feature.summary.pending"
              >Partial ·
              {{ feature.summary.missing + feature.summary.pending }} without
              cost</small
            ></strong
          >
          <small
            >Uncached input {{ model.tokenCount(feature.tokens.inputTokens) }} ·
            output {{ model.tokenCount(feature.tokens.outputTokens) }}</small
          >
        </button>
      </div>
      <h2 v-if="model.tasks.length">
        Task history <small>({{ model.tasks.length }})</small>
      </h2>
      <p v-if="model.tasks.length" class="cf-ai-table-help">
        Scroll across the task table to see provider, status, tokens and cost.
      </p>
      <div
        v-if="model.tasks.length"
        class="cf-ai-table-wrap cf-data-scroll"
        tabindex="0"
        role="region"
        aria-label="AI task details"
      >
        <table class="cf-ai-table">
          <caption class="sr-only">
            Every retained task and attempt, newest first
          </caption>
          <thead>
            <tr>
              <th scope="col">Feature / task</th>
              <th scope="col">Provider / model</th>
              <th scope="col">Status / started</th>
              <th scope="col">Usage · USD</th>
              <th scope="col">Uncached input tokens</th>
              <th scope="col">Output tokens</th>
              <th scope="col">Cost entry</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in model.visibleTasks" :key="task.id">
              <td>
                <code>{{ task.featureId }}</code> {{ task.featureTitle
                }}<small
                  >{{ task.workflow?.stepName ?? task.stage }} ·
                  {{ task.id }}</small
                >
                <small v-if="task.workflow"
                  >{{ task.workflow.stepId }} · workflow
                  {{ task.workflow.definitionRevision }}</small
                >
              </td>
              <td>
                {{ task.provider
                }}<small>{{ task.model || "Model not reported" }}</small>
              </td>
              <td>
                {{ task.status }}<small>{{ model.date(task.startedAt) }}</small>
              </td>
              <td>
                <strong>{{ model.cost(task).display }}</strong
                ><small>{{ model.cost(task).source }}</small>
              </td>
              <td>
                <strong>{{ model.tokens(task).input }}</strong
                ><small>{{ model.tokens(task).inputSource }}</small
                ><small
                  v-if="
                    task.usage?.cacheReadInputTokens !== undefined ||
                    task.usage?.cacheCreationInputTokens !== undefined
                  "
                  >Cache read {{ model.tokens(task).cacheRead }} · write
                  {{ model.tokens(task).cacheWrite }}</small
                >
              </td>
              <td>
                <strong>{{ model.tokens(task).output }}</strong
                ><small>{{ model.tokens(task).outputSource }}</small>
              </td>
              <td>
                <button
                  v-if="
                    task.provider !== 'demo' && task.reportedUsd === undefined
                  "
                  type="button"
                  class="cf-btn"
                  :aria-label="`${task.manualUsd === undefined ? 'Add cost' : 'Edit cost'} for ${task.featureId} ${task.workflow?.stepName ?? task.stage} ${task.id}`"
                  :disabled="model.store.busy"
                  @click="model.edit(task, $event)"
                >
                  {{
                    task.manualUsd === undefined ? "Add cost" : "Edit cost"
                  }}</button
                ><span v-else class="cf-muted">{{
                  task.provider === "demo" ? "Simulation" : "Provider reported"
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav
        v-if="model.pages > 1"
        class="cf-actions"
        aria-label="Task history pages"
      >
        <button
          type="button"
          class="cf-btn"
          :disabled="model.store.page === 0"
          @click="model.store.page--"
        >
          Previous tasks
        </button>
        <span
          >Page {{ model.store.page + 1 }} of {{ model.pages }} · 50 attempts
          per page</span
        >
        <button
          type="button"
          class="cf-btn"
          :disabled="model.store.page + 1 >= model.pages"
          @click="model.store.page++"
        >
          Next tasks
        </button>
      </nav>
      <p v-if="model.features.length > 50" class="cf-muted">
        Showing the first 50 feature summaries. Search or filter to find another
        feature; totals include every matching task.
      </p>
      <form
        v-if="model.store.editing"
        class="cf-ai-editor"
        aria-label="Manual task cost"
        @submit="model.save"
      >
        <h2>
          Manual cost · {{ model.store.editing.featureId }} /
          {{ model.store.editing.stage }}
        </h2>
        <p>
          Fallback estimate for this attempt only. A later provider report takes
          precedence.
        </p>
        <label
          >Amount · USD<input
            :ref="model.bindAmount"
            :disabled="model.store.busy"
            v-model="model.store.amount"
            inputmode="decimal"
            required
            autocomplete="off" /></label
        ><label
          >Source / note<textarea
            v-model="model.store.note"
            :disabled="model.store.busy"
            maxlength="2000"
            rows="3"
            placeholder="Invoice, tool report or estimate"
          ></textarea>
        </label>
        <div class="cf-actions">
          <button
            type="submit"
            class="cf-btn cf-btn-primary"
            :disabled="model.store.busy"
          >
            Save manual cost</button
          ><button
            type="button"
            class="cf-btn"
            :disabled="model.store.busy"
            @click="model.cancel"
          >
            Cancel</button
          ><button
            v-if="model.store.editing.manualUsd !== undefined"
            type="button"
            class="cf-btn"
            :disabled="model.store.busy"
            @click="model.clear"
          >
            Remove fallback
          </button>
        </div>
      </form>
    </template>
  </section>
</template>
