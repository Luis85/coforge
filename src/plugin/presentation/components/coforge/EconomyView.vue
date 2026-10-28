<script setup lang="ts">
import { useEconomy } from '../../composables/coforge/use-economy';
import { ECONOMY_PAGES } from '../../stores/studio-pages';
import CfSubpageNav from './CfSubpageNav.vue';
import EconomyCommands from './EconomyCommands.vue';
import EconomyEarning from './EconomyEarning.vue';
import EconomyRewards from './EconomyRewards.vue';
import EconomyLootboxes from './EconomyLootboxes.vue';
import EconomyFulfillment from './EconomyFulfillment.vue';
const model = useEconomy();
</script>
<template>
  <div class="cf-economy-page">
    <header class="cf-page-heading"><div><h1>Economy</h1><p>Set command prices, earning and rewards in {{ model.currency }}. Keep virtual account benefits and manual perk fulfillment explicit.</p></div><span v-if="model.ready" class="cf-badge">{{ model.dirty ? 'Unsaved rules' : `Saved revision ${model.store.snapshot?.configurationRevision}` }}</span></header>
    <p v-if="model.store.error" class="cf-inline-error" role="alert">{{ model.store.error }}</p>
    <p v-if="model.store.notice" role="status" class="cf-settings-help">{{ model.store.notice }}</p>
    <p v-if="!model.ready">Economy configuration is loading or unavailable. Existing account data is preserved.</p>
    <template v-else>
      <CfSubpageNav label="Economy pages" :items="ECONOMY_PAGES" :selected="model.store.page" @select="model.selectPage($event)" />
      <form v-show="model.store.page !== 'fulfillment'" aria-label="Economy configuration" novalidate @submit.prevent="model.save()">
        <fieldset class="cf-economy-config-fields" :disabled="model.store.busy"><legend class="cf-sr-only">Channel Economy rules</legend>
          <EconomyCommands v-show="model.store.page === 'commands'" />
          <EconomyEarning v-show="model.store.page === 'earning'" />
          <EconomyRewards v-show="model.store.page === 'rewards'" />
          <EconomyLootboxes v-show="model.store.page === 'lootboxes'" />
        </fieldset>
        <div class="cf-economy-save"><p class="cf-settings-help">{{ model.stale ? 'Rules changed elsewhere. Your draft is kept; discard to load the latest configuration.' : model.dirty ? 'Save to apply these rules to future successful commands. Existing receipts keep their captured values.' : 'Current rules are saved. Failed, rejected and duplicate operations receive no charge or reward.' }}</p><div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.dirty || model.store.busy" @click="model.discard()">Discard Economy changes</button><button type="submit" class="cf-btn cf-btn-primary" :disabled="!model.canSave">{{ model.store.busy ? 'Saving…' : 'Save Economy rules' }}</button></div></div>
      </form>
      <EconomyFulfillment v-show="model.store.page === 'fulfillment'" />
    </template>
  </div>
</template>
