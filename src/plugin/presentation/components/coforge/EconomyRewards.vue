<script setup lang="ts">
import { useEconomyModel } from '../../composables/coforge/use-economy';
const model = useEconomyModel();
</script>
<template>
  <section class="cf-economy-section" aria-label="Reward catalog configuration">
    <div><h2>Virtual benefits and manual perks</h2><p>Viewers discover prices with !shop and buy a reward with !redeem &lt;reward-id&gt;. The purchase price is additional to the redeem command fee. Command bonuses and loot-box prizes ignore this catalog price.</p></div>
    <div class="cf-settings-actions"><button type="button" class="cf-btn cf-btn-secondary" @click="model.addReward('virtual')">Add virtual reward</button><button type="button" class="cf-btn cf-btn-secondary" @click="model.addReward('perk')">Add manual perk</button></div>
    <div class="cf-economy-editor-layout">
      <section class="cf-economy-picker" aria-label="Rewards"><ul><li v-for="reward in model.store.draft.definition.rewards" :key="reward.id"><button type="button" :aria-pressed="model.store.rewardId === reward.id" @click="model.selectReward(reward.id)"><strong>{{ reward.name || 'Unnamed reward' }}</strong><small>{{ reward.kind === 'perk' ? 'Manual perk' : 'Virtual benefits' }} · {{ model.fee(reward.cost) }}</small></button></li></ul><p v-if="!model.store.draft.definition.rewards.length">No rewards yet. Add a virtual account benefit or a perk you will fulfill manually.</p></section>
      <section v-if="model.selectedReward" class="cf-economy-inspector" aria-label="Selected reward">
        <h3>{{ model.selectedReward.name || 'New reward' }}</h3><code>{{ model.selectedReward.id }}</code>
        <label class="cf-field"><span>Reward name</span><input v-model="model.selectedReward.name" aria-label="Reward name" maxlength="100"></label>
        <label class="cf-field"><span>Reward type</span><select :value="model.selectedReward.kind" aria-label="Reward type" @change="model.changeRewardKind($event)"><option value="virtual">Virtual account benefits</option><option value="perk">Manual perk fulfillment</option></select></label>
        <label class="cf-field"><span>Reward purchase price · {{ model.currency }}</span><input v-model.number="model.selectedReward.cost" aria-label="Reward purchase price" type="number" min="0" step="1"></label>
        <div v-if="model.selectedReward.kind === 'virtual'" class="cf-economy-three-fields"><label class="cf-field"><span>Currency granted</span><input v-model.number="model.selectedReward.coins" aria-label="Reward currency granted" type="number" min="0" step="1"></label><label class="cf-field"><span>XP granted</span><input v-model.number="model.selectedReward.xp" aria-label="Reward XP granted" type="number" min="0" step="1"></label><label class="cf-field"><span>Reputation granted</span><input v-model.number="model.selectedReward.reputation" aria-label="Reward reputation granted" type="number" min="0" step="1"></label></div>
        <label v-else class="cf-field"><span>Manual perk instructions</span><textarea v-model="model.selectedReward.description" aria-label="Manual perk instructions" rows="4" maxlength="1000" /><small>Explain what you will deliver. CoForge adds a fulfillment entry; it does not automate a physical or game action.</small></label>
        <p class="cf-settings-help">Removing a draft reward also removes its draft command and loot-box references. Existing receipts and fulfillment records keep their captured details.</p><button type="button" class="cf-btn cf-btn-danger" @click="model.removeReward()">Remove reward from draft</button>
      </section>
      <div v-else class="cf-intent-empty"><h3>Select a reward</h3><p>Review its purchase price and the benefits or manual work it grants.</p></div>
    </div>
  </section>
</template>
