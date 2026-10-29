import { number, shape, text } from '../domain/check';
import { defaultEconomyDefinition, type EconomyConfigurationInput, type EconomySnapshot, type EconomyState } from '../domain/command-economy';
import { economyCount, economyDefinitionCheck } from '../domain/command-economy-check';
import { contextEventId } from '../domain/integrity';
import type { InternalState } from './ports';
import type { StudioStore } from './studio-store';
import { recordOperation } from './population';

export const defaultEconomyState = (): EconomyState => ({ configurationRevision: 0, definition: defaultEconomyDefinition(), usages: [], usageTombstones: {}, redemptions: [], droppedUsages: 0 });
export function ensureEconomyState(state: InternalState): EconomyState { return state.population.economy ??= defaultEconomyState(); }
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
  return value;
}
function identity(state: InternalState): string {
  return contextEventId(JSON.stringify(ordered({ definition: state.population.economy?.definition ?? defaultEconomyDefinition(), coinsPerMinute: state.population.rules.coinsPerMinute })));
}
/** Reading defaults does not mutate or migrate existing account data. */
export function economySnapshot(store: StudioStore): EconomySnapshot {
  const state = store.internalSnapshot(); const economy = ensureEconomyState(state);
  return { definition: economy.definition, configurationRevision: economy.configurationRevision, configurationIdentity: identity(state), coinsPerMinute: state.population.rules.coinsPerMinute, currencyName: state.population.environment.currencyName, usages: economy.usages, redemptions: economy.redemptions, droppedUsages: economy.droppedUsages };
}
const configurationCheck = shape({ definition: economyDefinitionCheck, coinsPerMinute: number({ integer: true, min: 0, max: 100000 }) }, { strict: true });
export function saveEconomyConfiguration(store: StudioStore, input: EconomyConfigurationInput, expectedConfigurationIdentity: string): Promise<void> {
  const parsed = configurationCheck(input);
  return store.transaction(state => {
    if (identity(state) !== expectedConfigurationIdentity) throw new Error('Economy configuration changed elsewhere. Your draft was not written; refresh and review the current rules.');
    const economy = ensureEconomyState(state);
    economy.configurationRevision = economyCount(economy.configurationRevision + 1);
    economy.definition = parsed.definition;
    state.population.rules.coinsPerMinute = parsed.coinsPerMinute;
    recordOperation(state, 'economy-configuration-updated');
  });
}
export function fulfillEconomyPerk(store: StudioStore, id: string, expectedRevision: number, note: string): Promise<void> {
  const savedNote = text({ trim: true, max: 2000 })(note);
  return store.transaction(state => {
    const entry = ensureEconomyState(state).redemptions.find(item => item.id === id);
    if (!entry || entry.revision !== expectedRevision) throw new Error('This fulfillment entry changed. Refresh and review it before recording fulfillment; your note is kept.');
    if (entry.status !== 'pending') throw new Error('This perk is already fulfilled. No fulfillment record was repeated.');
    entry.status = 'fulfilled'; entry.fulfilledAt = new Date().toISOString(); entry.fulfillmentNote = savedNote;
    entry.revision = economyCount(entry.revision + 1);
    recordOperation(state, 'economy-perk-fulfilled', 'committed', undefined, 1, id);
  });
}
