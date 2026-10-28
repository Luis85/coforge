import { defineStore } from 'pinia';
import { ref } from 'vue';
import { defaultEconomyDefinition, type EconomyCommand, type EconomyConfigurationInput, type EconomySnapshot } from '../../features/coforge/domain/command-economy';
import type { EconomyPage } from './studio-pages';

/** Per-leaf authoring state; server snapshots remain separate from editable configuration. */
export const useEconomyStore = defineStore('coforge-economy', () => {
  const snapshot = ref<EconomySnapshot | null>(null);
  const draft = ref<EconomyConfigurationInput>({ definition: defaultEconomyDefinition(), coinsPerMinute: 0 });
  const initialized = ref(false);
  const expectedIdentity = ref('');
  const baseline = ref('');
  const page = ref<EconomyPage>('commands');
  const command = ref<EconomyCommand>('help');
  const rewardId = ref('');
  const boxId = ref('');
  const premiumDraft = ref(0);
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  const fulfillmentFilter = ref<'pending' | 'fulfilled' | 'all'>('pending');
  const fulfillmentSearch = ref('');
  const fulfillmentPage = ref(0);
  const redemptionId = ref('');
  const redemptionRevision = ref(0);
  const fulfillmentNote = ref('');
  return { snapshot, draft, initialized, expectedIdentity, baseline, page, command, rewardId, boxId, premiumDraft, busy, error, notice, fulfillmentFilter, fulfillmentSearch, fulfillmentPage, redemptionId, redemptionRevision, fulfillmentNote };
});
