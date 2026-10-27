<script setup lang="ts">
import { useCommunitySettings } from "../../composables/coforge/use-community-settings";
const model = useCommunitySettings();
</script>
<template>
  <div class="cf-community-settings-page">
    <header class="cf-page-heading">
      <div>
        <h1>Community settings</h1>
        <p>Names, earning rules and the rank ladder shared across the community.</p>
      </div>
    </header>
    <form ref="communitySettingsForm" class="cf-community-settings-form" @submit="model.save">
      <section aria-label="Environment names">
        <h2>Environment</h2>
        <div class="cf-economy-fields">
          <label class="cf-field"
            ><span>Community actor name</span
            ><input v-model="model.environment.actorName" type="text" maxlength="40" required /></label
          ><label class="cf-field"
            ><span>Currency name</span
            ><input v-model="model.environment.currencyName" type="text" maxlength="40" required
          /></label>
        </div>
        <p>
          These labels appear in player profiles and chatbot replies. Changing a label keeps the underlying balances.
        </p>
      </section>
      <section aria-label="Community earning rules">
        <h2>Earning rules</h2>
        <p>
          Rates apply to future credited chat-presence minutes and feature milestones. Existing balances stay unchanged.
        </p>
        <div class="cf-economy-fields">
          <label v-for="field in model.ruleFields" :key="field.key" class="cf-field"
            ><span>{{ field.label }}</span
            ><input v-model.number="model.rules[field.key]" type="number" min="0" max="100000" required
          /></label>
        </div>
      </section>
      <section aria-label="Named rank ladder">
        <h2>Rank ladder</h2>
        <p>
          A viewer holds the highest named rank whose minimum XP they have reached. Include a starting rank at 0 XP.
          Ranks are sorted by XP when saved.
        </p>
        <div class="cf-rank-ladder">
          <div v-for="(rank, index) in model.environment.ranks" :key="index" class="cf-rank-row">
            <label class="cf-field"
              ><span>Rank {{ index + 1 }} name</span
              ><input v-model="rank.name" :data-rank-name="index" type="text" maxlength="40" required /></label
            ><label class="cf-field"
              ><span>Rank {{ index + 1 }} minimum XP</span
              ><input v-model.number="rank.minimumXp" type="number" min="0" max="1000000000" required /></label
            ><button
              type="button"
              class="cf-btn cf-btn-ghost"
              :disabled="model.environment.ranks.length === 1"
              :aria-label="`Remove rank ${index + 1}`"
              @click="model.removeRank(index)"
            >
              Remove
            </button>
          </div>
        </div>
        <button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.environment.ranks.length >= 100"
          @click="model.addRank()"
        >
          Add rank
        </button>
      </section>
      <p v-if="model.error" class="cf-inline-error" role="alert">{{ model.error }}</p>
      <p v-if="model.notice" role="status">{{ model.notice }}</p>
      <div class="cf-settings-actions">
        <button type="submit" class="cf-btn cf-btn-primary" :disabled="model.working || !model.dirty">
          Save community settings</button
        ><button
          type="button"
          class="cf-btn cf-btn-secondary"
          :disabled="model.working || !model.dirty"
          @click="model.revert()"
        >
          Discard changes
        </button>
      </div>
    </form>
  </div>
</template>
