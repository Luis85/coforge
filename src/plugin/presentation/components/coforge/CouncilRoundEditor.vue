<script setup lang="ts">
import { useCouncilEditorForm } from "../../composables/coforge/use-council-definitions";
const model = useCouncilEditorForm();
</script>
<template>
  <section
    v-if="model.store.draft?.schema === 'council/v1'"
    aria-label="Council rounds"
  >
    <div class="cf-settings-actions">
      <h3>Sequential rounds</h3>
      <button
        type="button"
        class="cf-btn cf-btn-secondary"
        @click="model.addRound()"
      >
        Add round
      </button>
    </div>
    <p class="cf-settings-help">
      Source and captured team context are included in every round. Only
      selected earlier collections are included. Project and vault tools stay
      disabled.
    </p>
    <div
      v-for="(round, index) in model.store.draft.rounds"
      :key="round.id"
      class="cf-council-round"
    >
      <div class="cf-settings-actions">
        <h4>{{ index + 1 }}. {{ round.name }}</h4>
        <button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="index === 0"
          :aria-label="`Move ${round.name} earlier`"
          @click="model.move(model.store.draft.rounds, index, -1)"
        >
          Earlier</button
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="index === model.store.draft.rounds.length - 1"
          :aria-label="`Move ${round.name} later`"
          @click="model.move(model.store.draft.rounds, index, 1)"
        >
          Later</button
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          @click="model.duplicateRound(index)"
        >
          Duplicate round</button
        ><button
          type="button"
          class="cf-btn cf-btn-ghost"
          :disabled="model.store.draft.rounds.length === 1"
          @click="model.store.draft.rounds.splice(index, 1)"
        >
          Remove round
        </button>
      </div>
      <label class="cf-field"
        ><span>Round name</span
        ><input v-model="round.name" maxlength="100" required
      /></label>
      <label class="cf-field"
        ><span>Contribution type</span
        ><select v-model="round.kind">
          <option value="opinion">Opinion</option>
          <option value="solution">Solution proposal</option>
          <option value="synthesis">Chair synthesis (one member)</option>
        </select></label
      >
      <label class="cf-field"
        ><span>Round instructions</span
        ><textarea v-model="round.instructions" rows="4" maxlength="16000" />
      </label>
      <label class="cf-field"
        ><span>Validated round result contract</span
        ><select v-model="round.output">
          <option value="markdown">Analytical Markdown</option>
          <option value="plan">Validated implementation plan</option>
        </select></label
      >
      <fieldset>
        <legend>Participants in invocation order</legend>
        <label
          v-for="member in model.store.draft.members"
          :key="member"
          class="cf-check"
          ><input
            type="checkbox"
            :checked="round.participants.includes(member)"
            @change="
              round.participants = round.participants.includes(member)
                ? round.participants.filter((id) => id !== member)
                : [...round.participants, member]
            "
          />{{ model.membership(member) }}</label
        >
        <ol class="cf-council-order">
          <li v-for="(id, position) in round.participants" :key="id">
            <span>{{ model.membership(id) }}</span
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :disabled="position === 0"
              :aria-label="`Move ${model.membership(id)} earlier in ${round.name}`"
              @click="model.move(round.participants, position, -1)"
            >
              Earlier</button
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :disabled="position === round.participants.length - 1"
              :aria-label="`Move ${model.membership(id)} later in ${round.name}`"
              @click="model.move(round.participants, position, 1)"
            >
              Later
            </button>
          </li>
        </ol>
      </fieldset>
      <fieldset>
        <legend>Included earlier collections</legend>
        <p v-if="index === 0" class="cf-settings-help">
          Independent contributions: no earlier opinions are included.
        </p>
        <label
          v-for="earlier in model.store.draft.rounds.slice(0, index)"
          :key="earlier.id"
          class="cf-check"
          ><input
            type="checkbox"
            :checked="round.inputs.includes(earlier.id)"
            @change="
              model.toggleInput(
                round,
                earlier.id,
                !round.inputs.includes(earlier.id),
              )
            "
          />{{ earlier.name }}</label
        >
      </fieldset>
      <label class="cf-check"
        ><input
          type="checkbox"
          :checked="round.completion.kind === 'partial'"
          @change="model.partial(round, round.completion.kind !== 'partial')"
        />
        Allow explicitly skipped members</label
      >
      <label v-if="round.completion.kind === 'partial'" class="cf-field"
        ><span>Minimum successful contributions</span
        ><input
          v-model.number="round.completion.minimum"
          type="number"
          min="1"
          :max="round.participants.length"
      /></label>
      <p class="cf-settings-help">
        {{ round.participants.length }} invocations ·
        {{
          round.inputs.length
            ? "Selected complete collections"
            : "Independent input"
        }}
        ·
        {{
          round.completion.kind === "all"
            ? "Every member required"
            : "Missing members remain visible"
        }}
      </p>
    </div>
  </section>
</template>
