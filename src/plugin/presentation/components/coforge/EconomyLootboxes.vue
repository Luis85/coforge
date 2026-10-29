<script setup lang="ts">
import { useEconomyModel } from '../../composables/coforge/use-economy';
const model = useEconomyModel();
</script>
<template>
  <section class="cf-economy-section" aria-label="Weighted loot box configuration">
    <div><h2>Make every outcome visible</h2><p>A box chooses a weighted reward. Viewers inspect saved odds with !odds &lt;box-id&gt; and buy an opening with !lootbox &lt;box-id&gt;. Purchases add the box price to the command fee; bonus openings ignore the box price.</p></div>
    <button type="button" class="cf-btn cf-btn-secondary" @click="model.addBox()">Add loot box</button>
    <div class="cf-economy-editor-layout">
      <section class="cf-economy-picker" aria-label="Loot boxes"><ul><li v-for="box in model.store.draft.definition.lootboxes" :key="box.id"><button type="button" :aria-pressed="model.store.boxId === box.id" @click="model.selectBox(box.id)"><strong>{{ box.name || 'Unnamed loot box' }}</strong><small>{{ model.fee(box.cost) }} · {{ box.entries.length }} outcomes</small></button></li></ul><p v-if="!model.store.draft.definition.lootboxes.length">No loot boxes yet. Define rewards first, then choose their weights in a box.</p></section>
      <section v-if="model.selectedBox" class="cf-economy-inspector" aria-label="Selected loot box"><h3>{{ model.selectedBox.name || 'New loot box' }}</h3><code>{{ model.selectedBox.id }}</code>
        <label class="cf-field"><span>Loot box name</span><input v-model="model.selectedBox.name" aria-label="Loot box name" maxlength="100"></label>
        <label class="cf-field"><span>Loot box purchase price · {{ model.currency }}</span><input v-model.number="model.selectedBox.cost" aria-label="Loot box purchase price" type="number" min="0" step="1"></label>
        <h4>{{ model.dirty ? 'Draft outcome odds' : 'Saved outcome odds' }}</h4><p class="cf-settings-help">Percentages are approximate; the exact reward weight fraction combines entries for the same reward. Repeated rewards also show this entry’s fraction. Saving does not open a box or grant a reward.</p>
        <div v-for="(entry, index) in model.selectedBox.entries" :key="index" class="cf-economy-outcome"><label class="cf-field"><span>Outcome reward {{ index + 1 }}</span><select v-model="entry.rewardId" :aria-label="`Outcome reward ${index + 1}`"><option v-for="reward in model.store.draft.definition.rewards" :key="reward.id" :value="reward.id">{{ reward.name || 'Unnamed reward' }}</option></select></label><label class="cf-field"><span>Weight {{ index + 1 }}</span><input v-model.number="entry.weight" :aria-label="`Outcome weight ${index + 1}`" type="number" min="0" step="1"></label><p>{{ model.odds(model.selectedBox, index) }}</p><button type="button" class="cf-btn cf-btn-ghost" :aria-label="`Remove outcome ${index + 1}`" @click="model.removeOutcome(index)">Remove</button></div>
        <button type="button" class="cf-btn cf-btn-secondary" :disabled="!model.store.draft.definition.rewards.length" @click="model.addOutcome()">Add outcome</button><p v-if="!model.store.draft.definition.rewards.length" class="cf-settings-help">Add a reward before configuring an outcome.</p>
        <button type="button" class="cf-btn cf-btn-danger" @click="model.removeBox()">Remove loot box from draft</button>
      </section>
      <div v-else class="cf-intent-empty"><h3>Select a loot box</h3><p>Review its purchase price, exact weights and prize definitions.</p></div>
    </div>
  </section>
</template>
