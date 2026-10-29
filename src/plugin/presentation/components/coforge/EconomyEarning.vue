<script setup lang="ts">
import { useEconomyModel } from '../../composables/coforge/use-economy';
const model = useEconomyModel();
</script>
<template>
  <section class="cf-economy-section" aria-label="Tracked presence earning">
    <div><h2>Fund participation through live presence</h2><p>Observed profiles, including unregistered viewers, earn currency through eligible tracked live chat-presence intervals. Registration and help can have fees. New profiles receive no automatic starting credits.</p></div>
    <div class="cf-economy-earning-layout">
      <label class="cf-field"><span>Base currency per credited minute</span><input v-model.number="model.store.draft.coinsPerMinute" aria-label="Base currency per credited minute" type="number" min="0" step="1"><small>{{ model.currency }} for a credited live chat-presence minute. XP and reputation rules remain in Community settings.</small></label>
      <section><h3>Subscriber currency</h3><label class="cf-economy-check"><input type="checkbox" :checked="model.store.draft.definition.premiumCurrencyPerMinute !== undefined" @change="model.togglePremium($event)"><span>Use a separate subscriber total rate</span></label><label v-if="model.store.draft.definition.premiumCurrencyPerMinute !== undefined" class="cf-field"><span>Subscriber total per credited minute</span><input v-model.number="model.store.draft.definition.premiumCurrencyPerMinute" aria-label="Subscriber total per credited minute" type="number" min="0" step="1"><small>This total replaces the base rate. It is not an additional bonus.</small></label><p v-else class="cf-settings-help">Subscribers inherit the base rate of {{ model.number(model.store.draft.coinsPerMinute) }} {{ model.currency }} per credited minute.</p></section>
    </div>
    <div class="cf-economy-policy"><h3>What is measured</h3><p>Currency is credited only for eligible live, connected chat-presence intervals. Disconnected, missing and offline gaps are not filled. This does not verify video watch time.</p><p>Subscriber rates require current subscriber evidence. Existing participation restrictions and XP rules remain authoritative.</p></div>
  </section>
</template>
