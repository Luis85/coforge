import type { useEconomyStore } from '../../stores/coforge-economy';
import type { EconomyReward } from '../../../features/coforge/domain/command-economy';

/** Draft-only catalog changes; existing usage and fulfillment records are never edited here. */
export function economyEditorActions(store: ReturnType<typeof useEconomyStore>) {
  const selectedReward = () => store.draft.definition.rewards.find(reward => reward.id === store.rewardId);
  const selectedBox = () => store.draft.definition.lootboxes.find(box => box.id === store.boxId);
  return {
    addReward: (kind: EconomyReward['kind']) => {
      if (store.busy) return;
      const id = `reward-${crypto.randomUUID()}`;
      const reward: EconomyReward = kind === 'virtual' ? { id, name: '', kind, cost: 0, coins: 0, xp: 0, reputation: 0 } : { id, name: '', kind, cost: 0, description: '' };
      store.draft.definition.rewards.push(reward); store.rewardId = id;
    },
    removeReward: () => {
      if (store.busy || !selectedReward()) return;
      const id = store.rewardId;
      store.draft.definition.rewards = store.draft.definition.rewards.filter(reward => reward.id !== id);
      for (const rule of Object.values(store.draft.definition.commandRules)) rule.rewardIds = rule.rewardIds.filter(value => value !== id);
      for (const box of store.draft.definition.lootboxes) box.entries = box.entries.filter(entry => entry.rewardId !== id);
      store.rewardId = store.draft.definition.rewards[0]?.id ?? '';
    },
    changeRewardKind: (event: Event) => {
      const target = event.target; const reward = selectedReward();
      if (store.busy || !reward || !target || !('value' in target) || (target.value !== 'virtual' && target.value !== 'perk') || reward.kind === target.value) return;
      const next: EconomyReward = target.value === 'virtual' ? { id: reward.id, name: reward.name, cost: reward.cost, kind: 'virtual', coins: 0, xp: 0, reputation: 0 } : { id: reward.id, name: reward.name, cost: reward.cost, kind: 'perk', description: '' };
      store.draft.definition.rewards = store.draft.definition.rewards.map(item => item.id === reward.id ? next : item);
    },
    addBox: () => {
      if (store.busy) return;
      const id = `box-${crypto.randomUUID()}`;
      store.draft.definition.lootboxes.push({ id, name: '', cost: 0, entries: [] }); store.boxId = id;
    },
    removeBox: () => {
      if (store.busy || !selectedBox()) return;
      const id = store.boxId;
      store.draft.definition.lootboxes = store.draft.definition.lootboxes.filter(box => box.id !== id);
      for (const rule of Object.values(store.draft.definition.commandRules)) rule.lootboxIds = rule.lootboxIds.filter(value => value !== id);
      store.boxId = store.draft.definition.lootboxes[0]?.id ?? '';
    },
    addOutcome: () => {
      const box = selectedBox(); const reward = store.draft.definition.rewards[0];
      if (!store.busy && box && reward) box.entries.push({ rewardId: reward.id, weight: 1 });
    },
    removeOutcome: (index: number) => { if (!store.busy) selectedBox()?.entries.splice(index, 1); },
    togglePremium: (event: Event) => {
      const target = event.target;
      if (store.busy || !target || !('checked' in target) || typeof target.checked !== 'boolean') return;
      if (target.checked) store.draft.definition.premiumCurrencyPerMinute = store.premiumDraft;
      else { store.premiumDraft = store.draft.definition.premiumCurrencyPerMinute ?? store.draft.coinsPerMinute; delete store.draft.definition.premiumCurrencyPerMinute; }
    },
  };
}
