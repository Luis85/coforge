import { computed, inject, onBeforeUnmount, onMounted, provide, reactive, watch, type InjectionKey } from 'vue';
import { useCoforge } from '../../context/coforge-context';
import { useStudioStore } from '../../stores/coforge-studio';
import { useEconomyStore } from '../../stores/coforge-economy';
import { ECONOMY_COMMANDS, type EconomyCommand, type EconomyPerkRedemption } from '../../../features/coforge/domain/command-economy';
import { copyEconomyConfiguration, creditedMinutes, economyDraftKey, economyNumber, lootboxOdds } from './economy-draft';
import { economyEditorActions } from './economy-editor-actions';
import { ECONOMY_PAGES } from '../../stores/studio-pages';

function createEconomy() {
  const { studio } = useCoforge(); const studioStore = useStudioStore(); const store = useEconomyStore();
  let closed = false;
  const dirty = computed(() => store.initialized && economyDraftKey(store.draft) !== store.baseline);
  const stale = computed(() => Boolean(store.snapshot && store.initialized && store.snapshot.configurationIdentity !== store.expectedIdentity));
  function load(snapshot: ReturnType<typeof studio.getEconomy>) {
    store.snapshot = snapshot; store.draft = copyEconomyConfiguration(snapshot);
    store.expectedIdentity = snapshot.configurationIdentity; store.baseline = economyDraftKey(store.draft);
    store.premiumDraft = snapshot.definition.premiumCurrencyPerMinute ?? snapshot.coinsPerMinute;
    store.initialized = true; store.error = '';
  }
  function refresh() {
    if (closed) return;
    try {
      const snapshot = studio.getEconomy(); store.snapshot = snapshot;
      if (!store.initialized || (!dirty.value && !store.busy)) load(snapshot);
      else if (!store.busy && stale.value) store.error = 'Economy configuration changed elsewhere. Your draft is kept; copy your edits, then discard to load the current rules.';
    } catch (error) { store.error = error instanceof Error ? error.message : 'Economy configuration is unavailable. Existing data is preserved.'; }
  }
  watch(() => studioStore.state, refresh);
  watch(dirty, value => { studioStore.dirtyEconomy = value; }, { immediate: true });
  onMounted(refresh);
  onBeforeUnmount(() => { closed = true; studioStore.dirtyEconomy = false; });
  async function save() {
    if (store.busy || !dirty.value || stale.value) return;
    store.busy = true; store.error = ''; store.notice = '';
    try {
      const draft = copyEconomyConfiguration(store.draft); const submittedKey = economyDraftKey(draft);
      await studioStore.mutate(() => studio.saveEconomyConfiguration(draft, store.expectedIdentity));
      const snapshot = studio.getEconomy(); store.snapshot = snapshot;
      if (economyDraftKey(copyEconomyConfiguration(snapshot)) !== submittedKey) store.error = 'Your rules were saved, then changed again elsewhere. Your draft is kept; discard to review the latest configuration.';
      else { load(snapshot); store.notice = 'Economy rules saved. Future successful commands use this configuration.'; }
    } catch (error) { store.error = error instanceof Error ? error.message : 'The Economy rules could not be saved. Your draft is kept.'; }
    finally { store.busy = false; }
  }
  const selectedRedemption = computed(() => store.snapshot?.redemptions.find(item => item.id === store.redemptionId));
  async function fulfill() {
    const item = selectedRedemption.value;
    if (store.busy || !item || item.status !== 'pending') return;
    store.busy = true; store.error = ''; store.notice = '';
    try {
      await studioStore.mutate(() => studio.fulfillEconomyPerk(item.id, store.redemptionRevision, store.fulfillmentNote));
      store.redemptionId = ''; store.fulfillmentNote = ''; refresh();
      store.notice = 'Manual fulfillment recorded with its private note.';
    } catch (error) { store.error = error instanceof Error ? error.message : 'Fulfillment could not be recorded. Your note is kept.'; }
    finally { store.busy = false; }
  }
  const names = computed(() => new Map(studioStore.state?.contributors.map(person => [person.id, person.name])));
  const filteredRedemptions = computed(() => [...(store.snapshot?.redemptions ?? [])].reverse().filter(item => (store.fulfillmentFilter === 'all' || item.status === store.fulfillmentFilter)
    && `${names.value.get(item.playerId) ?? item.playerId} ${item.rewardName} ${item.id}`.toLowerCase().includes(store.fulfillmentSearch.toLowerCase())));
  const fulfillmentPages = computed(() => Math.max(1, Math.ceil(filteredRedemptions.value.length / 50)));
  watch(() => [store.fulfillmentFilter, store.fulfillmentSearch], () => { store.fulfillmentPage = 0; });
  watch(fulfillmentPages, pages => { store.fulfillmentPage = Math.min(store.fulfillmentPage, pages - 1); });
  return reactive({
    store, dirty, stale,
    ready: computed(() => Boolean(store.snapshot && store.initialized)),
    currency: computed(() => store.snapshot?.currencyName ?? 'community currency'),
    commands: ECONOMY_COMMANDS,
    selectedRule: computed(() => store.draft.definition.commandRules[store.command]),
    selectedReward: computed(() => store.draft.definition.rewards.find(item => item.id === store.rewardId)),
    selectedBox: computed(() => store.draft.definition.lootboxes.find(item => item.id === store.boxId)),
    selectedRedemption,
    redemptions: computed(() => filteredRedemptions.value.slice(store.fulfillmentPage * 50, (store.fulfillmentPage + 1) * 50)),
    fulfillmentPages,
    pendingCount: computed(() => store.snapshot?.redemptions.filter(item => item.status === 'pending').length ?? 0),
    recentUsage: computed(() => [...(store.snapshot?.usages ?? [])].reverse().slice(0, 50)),
    canSave: computed(() => dirty.value && !stale.value && !store.busy),
    selectPage: (page: string) => { const selected = ECONOMY_PAGES.find(item => item.id === page); if (selected) store.page = selected.id; },
    selectCommand: (command: EconomyCommand) => { store.command = command; },
    selectReward: (id: string) => { store.rewardId = id; },
    selectBox: (id: string) => { store.boxId = id; },
    save: () => { void save(); },
    discard: () => { if (!store.busy) { try { load(studio.getEconomy()); store.notice = ''; } catch (error) { store.error = error instanceof Error ? error.message : 'Current Economy rules are unavailable.'; } } },
    refresh,
    ...economyEditorActions(store),
    number: economyNumber,
    fee: (value: number) => value === 0 ? 'Free' : `${economyNumber(value)} ${store.snapshot?.currencyName ?? ''}`,
    affordability: (value: number) => creditedMinutes(value, store.draft.coinsPerMinute),
    odds: lootboxOdds,
    rewardName: (id: string) => store.draft.definition.rewards.find(item => item.id === id)?.name || 'Unnamed reward',
    viewer: (id: string) => names.value.get(id) ?? id,
    date: (value: string) => new Date(value).toLocaleString(),
    openFulfillment: (item: EconomyPerkRedemption) => {
      if (store.busy || store.redemptionId === item.id) return;
      if (selectedRedemption.value && store.fulfillmentNote !== (selectedRedemption.value.fulfillmentNote ?? '')) {
        store.error = 'Record or cancel the current fulfillment note before choosing another perk. Your note is kept.'; return;
      }
      store.redemptionId = item.id; store.redemptionRevision = item.revision; store.fulfillmentNote = item.fulfillmentNote ?? ''; store.error = '';
    },
    cancelFulfillment: () => { if (!store.busy) { store.redemptionId = ''; store.fulfillmentNote = ''; } },
    fulfill: () => { void fulfill(); },
  });
}
export type EconomyModel = ReturnType<typeof createEconomy>;
const ECONOMY_KEY: InjectionKey<EconomyModel> = Symbol('coforge-economy-model');
export function useEconomy(): EconomyModel { const model = createEconomy(); provide(ECONOMY_KEY, model); return model; }
export function useEconomyModel(): EconomyModel { const model = inject(ECONOMY_KEY, null); if (!model) throw new Error('ECONOMY_CONTEXT_MISSING'); return model; }
