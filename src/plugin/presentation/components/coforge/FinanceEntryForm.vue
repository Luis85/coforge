<script setup lang="ts">
import type { FinanceModel } from "../../composables/coforge/use-finance";
defineProps<{ model: FinanceModel }>();
</script>
<template>
  <section aria-label="Finance entry editor">
    <h2>{{ model.editing ? "Edit entry" : "Add entry" }}</h2>
    <form @submit="model.save">
      <label class="cf-field"
        ><span>Entry type</span
        ><select v-model="model.store.draft.kind" aria-label="Entry type">
          <option value="expense">Expense payment</option>
          <option value="income">Income received</option>
          <option value="recurring">Recurring expense plan</option>
        </select></label
      >
      <label class="cf-field"
        ><span>Finance description</span
        ><input v-model="model.store.draft.name" required maxlength="200"
      /></label>
      <label class="cf-field"
        ><span>Amount (EUR)</span
        ><input
          v-model="model.store.amount"
          aria-label="Amount (EUR)"
          aria-describedby="cf-finance-amount-help"
          inputmode="decimal"
          required
          placeholder="0.00"
        /><small id="cf-finance-amount-help"
          >Positive amount, up to two decimal places. Use a dot or comma without
          grouping separators.</small
        ></label
      >
      <label class="cf-field"
        ><span>{{
          model.store.draft.kind === "recurring"
            ? "Plan start date"
            : "Payment date"
        }}</span
        ><input
          v-model="model.store.draft.date"
          aria-label="Finance date"
          type="date"
          required
      /></label>
      <label class="cf-field"
        ><span>Finance category</span
        ><input
          v-model="model.store.draft.category"
          maxlength="100"
          placeholder="For example: software, tips, sponsorship"
      /></label>
      <template v-if="model.store.draft.kind === 'recurring'">
        <label class="cf-field"
          ><span>Expense interval</span
          ><select
            v-model="model.store.draft.cadence"
            aria-label="Expense interval"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select></label
        >
        <label class="cf-project-repository-toggle"
          ><input v-model="model.store.draft.active" type="checkbox" /><span
            >Recurring plan active</span
          ></label
        >
        <p>
          This plan forecasts a commitment. Record each actual payment
          separately; pausing a plan does not change recorded expenses.
        </p>
      </template>
      <label v-else class="cf-field"
        ><span>Attributed stream</span
        ><select
          v-model="model.store.draft.streamId"
          aria-label="Attributed stream"
        >
          <option value="">Not attributed to a stream</option>
          <option
            v-if="
              model.store.draft.streamId &&
              !model.streams.some(
                (stream) => stream.id === model.store.draft.streamId,
              )
            "
            :value="model.store.draft.streamId"
          >
            {{ model.store.draft.streamId }} · history unavailable
          </option>
          <option
            v-for="stream in model.streams"
            :key="stream.id"
            :value="stream.id"
          >
            {{ model.streamName(stream.id) }}
          </option>
        </select></label
      >
      <div class="cf-settings-actions">
        <button
          type="submit"
          class="cf-btn cf-btn-primary"
          :disabled="model.store.busy || !model.store.ready"
        >
          Save finance entry</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.store.busy"
          @click="model.reset()"
        >
          New finance entry
        </button>
      </div>
    </form>
  </section>
</template>
