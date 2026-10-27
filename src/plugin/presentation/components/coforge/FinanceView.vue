<script setup lang="ts">
import { useFinance } from "../../composables/coforge/use-finance";
import FinanceEntryForm from "./FinanceEntryForm.vue";
const model = useFinance();
</script>
<template>
  <div class="cf-finance">
    <header class="cf-page-heading">
      <div>
        <h1>Stream finances</h1>
        <p>Manual income, expense payments and recurring commitments in EUR.</p>
      </div>
      <button
        v-if="model.available"
        type="button"
        class="cf-btn cf-btn-secondary"
        :disabled="model.store.busy"
        @click="model.refresh()"
      >
        Refresh finances
      </button>
    </header>
    <p v-if="model.store.example">
      Finance example · in-memory entries only; nothing is saved to your vault.
    </p>
    <template v-if="!model.available"
      ><p>
        Keep your private ledger in CoForge/Finance/Ledger.md inside Obsidian.
      </p>
      <button
        v-if="model.canPreview"
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.preview()"
      >
        Explore finance example
      </button></template
    >
    <template v-else>
      <div class="cf-finance-filters">
        <label class="cf-field"
          ><span>Finance month</span
          ><input v-model="model.store.month" type="month" required /></label
        ><label class="cf-field"
          ><span>Finance stream filter</span
          ><select
            v-model="model.store.stream"
            aria-label="Finance stream filter"
          >
            <option value="">All streams and unassigned entries</option>
            <option
              v-for="stream in model.streams"
              :key="stream.id"
              :value="stream.id"
            >
              {{ model.streamName(stream.id) }}
            </option>
          </select></label
        >
      </div>
      <dl class="cf-finance-totals">
        <div aria-label="Actual income">
          <dt>Income received</dt>
          <dd>{{ model.money(model.totals.income) }}</dd>
        </div>
        <div aria-label="Actual expenses">
          <dt>Expenses paid</dt>
          <dd>{{ model.money(model.totals.expenses) }}</dd>
        </div>
        <div aria-label="Actual balance">
          <dt>Recorded balance</dt>
          <dd>{{ model.money(model.totals.balance) }}</dd>
        </div>
        <div aria-label="Planned monthly costs">
          <dt>Active plans / month</dt>
          <dd>{{ model.money(model.totals.plannedMonthly) }}</dd>
        </div>
      </dl>
      <p>
        Actual totals follow the month and stream filters. Plans remain
        channel-wide and separate from payments: weekly × 52 ÷ 12, yearly ÷ 12,
        without proration. Only active plans starting by month end count.
      </p>
      <div class="cf-finance-workspace">
        <FinanceEntryForm :model="model" />
        <section aria-label="Recorded finance entries">
          <h2>Entries and plans</h2>
          <p v-if="!model.entries.length">
            No entries for this selection. Add a payment, income received or a
            recurring expense plan.
          </p>
          <ul class="cf-finance-list" aria-label="Finance entries">
            <li v-for="entry in model.entries" :key="entry.id">
              <div>
                <strong>{{ entry.name }}</strong>
                <p>
                  {{
                    entry.kind === "recurring"
                      ? `Plan · ${entry.cadence} · ${entry.active ? "active" : "paused"}`
                      : entry.kind
                  }}
                  · {{ model.money(entry.amountCents) }} · {{ entry.date }}
                </p>
                <p>
                  {{ entry.category || "Uncategorized"
                  }}<span v-if="entry.kind !== 'recurring'">
                    · {{ model.streamName(entry.streamId) }}</span
                  >
                </p>
              </div>
              <div class="cf-settings-actions">
                <button
                  type="button"
                  class="cf-btn cf-btn-secondary"
                  :aria-label="`Edit ${entry.name}`"
                  :disabled="model.store.busy"
                  @click="model.edit(entry)"
                >
                  Edit</button
                ><button
                  v-if="entry.kind === 'recurring'"
                  type="button"
                  class="cf-btn cf-btn-secondary"
                  :disabled="model.store.busy"
                  @click="model.toggle(entry)"
                >
                  {{ entry.active ? "Pause plan" : "Activate plan" }}</button
                ><button
                  type="button"
                  class="cf-btn cf-btn-danger"
                  :aria-label="`Delete ${entry.name}`"
                  :disabled="model.store.busy"
                  @click="model.remove(entry)"
                >
                  Delete
                </button>
              </div>
            </li>
          </ul>
        </section>
      </div>
      <section
        v-if="model.store.removal"
        :ref="model.bindConfirmation"
        class="cf-finance-confirm"
        aria-label="Confirm finance deletion"
        tabindex="-1"
        @keydown.esc="model.cancelRemoval()"
      >
        <h2>Delete finance entry</h2>
        <p>
          Delete “{{ model.store.removal.entry.name }}” ·
          {{ model.money(model.store.removal.entry.amountCents) }} ·
          {{ model.store.removal.entry.date }}? This removes this record from
          the ledger.
        </p>
        <div class="cf-settings-actions">
          <button
            type="button"
            class="cf-btn cf-btn-danger"
            :disabled="model.store.busy"
            @click="model.confirmRemoval()"
          >
            Confirm finance deletion</button
          ><button
            type="button"
            class="cf-btn cf-btn-secondary"
            @click="model.cancelRemoval()"
          >
            Cancel deletion
          </button>
        </div>
      </section>
    </template>
    <p v-if="model.store.error" role="alert" class="cf-inline-error">
      {{ model.store.error }}
    </p>
    <p v-if="model.store.notice" role="status">{{ model.store.notice }}</p>
  </div>
</template>
