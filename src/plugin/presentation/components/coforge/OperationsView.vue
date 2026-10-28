<script setup lang="ts">
import { useOperations } from "../../composables/coforge/use-operations";
const model = useOperations();
</script>
<template>
  <div class="cf-operations-page">
    <header class="cf-page-heading">
      <div>
        <h1>Operations</h1>
        <p>Inspect recorded events, find failed actions and export diagnostics for troubleshooting.</p>
      </div>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.working || !model.canExport"
        @click="model.exportDiagnostics()"
      >
        Export safe diagnostics
      </button>
    </header>
    <section class="cf-decision-brief" aria-label="Retained operational evidence">
      <div>
        <h2>{{ model.unconfirmedCount }} unconfirmed {{ model.unconfirmedCount === 1 ? 'event' : 'events' }} in the retained log</h2>
        <p>These are historical outcomes. Inspect the owning tool for current state and recovery before repeating an action.</p>
      </div>
      <button v-if="model.unconfirmedCount" type="button" class="cf-btn cf-btn-secondary" @click="model.showUnconfirmed()">Inspect unconfirmed events</button>
    </section>
    <div class="cf-operation-groups">
      <section v-for="group in model.groups" :key="group.title">
        <h2>{{ group.title }}</h2>
        <dl class="cf-operations-stats">
          <div v-for="stat in group.stats" :key="stat.label">
            <dt>{{ stat.label }}</dt>
            <dd>{{ stat.value.toLocaleString() }}</dd>
          </div>
        </dl>
      </section>
    </div>
    <section class="cf-log-section" aria-label="Operational log">
      <h2>Operational log</h2>
      <p>{{ model.retention }}</p>
      <p>{{ model.rewardRetention }}</p>
      <div class="cf-population-toolbar">
        <label class="cf-field"
          ><span>Event type</span
          ><select v-model="model.code">
            <option value="">All events</option>
            <option v-for="code in model.codes" :key="code.id" :value="code.id">{{ code.label }}</option>
          </select></label
        ><label class="cf-field"
          ><span>Effect</span
          ><select v-model="model.effect">
            <option value="">All effects</option>
            <option value="committed">Committed</option>
            <option value="none">No change</option>
            <option value="uncertain">Unconfirmed</option>
          </select></label
        >
      </div>
      <div
        v-if="model.records.length"
        class="cf-data-scroll"
        tabindex="0"
        role="region"
        aria-label="Operational records"
      >
        <table class="cf-idea-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Effect</th>
              <th>Player</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in model.records" :key="record.sequence">
              <td>{{ record.time }}</td>
              <td :title="record.code">{{ record.label }}</td>
              <td>{{ record.effectLabel }}</td>
              <td>{{ record.player }}</td>
              <td>{{ record.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="cf-intent-empty"><p>No recorded events match this view.</p><button v-if="model.filtered" type="button" class="cf-btn cf-btn-secondary" @click="model.clearFilters()">Clear event filters</button></div>
      <p>
        Technical diagnostics contain declared event codes and safe aggregates. Chat text, credentials, note content and
        player identities are excluded from diagnostic exports.
      </p>
    </section>
    <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
    <p v-if="model.notice" role="status">{{ model.notice }}</p>
  </div>
</template>
