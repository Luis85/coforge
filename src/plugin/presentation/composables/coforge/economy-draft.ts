import { ECONOMY_COMMANDS, type EconomyConfigurationInput, type EconomyLootbox, type EconomySnapshot } from '../../../features/coforge/domain/command-economy';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
  return value;
}
export const economyDraftKey = (value: EconomyConfigurationInput): string => JSON.stringify(ordered(value));
/** Copy known fields individually: draft arrays can contain nested Vue proxies after edits. */
export function copyEconomyConfiguration(value: Pick<EconomySnapshot, 'definition' | 'coinsPerMinute'>): EconomyConfigurationInput {
  const definition = { ...value.definition, commandRules: { ...value.definition.commandRules }, rewards: value.definition.rewards.map(reward => ({ ...reward })), lootboxes: value.definition.lootboxes.map(box => ({ ...box, entries: box.entries.map(entry => ({ ...entry })) })) };
  for (const command of ECONOMY_COMMANDS) {
    const rule = value.definition.commandRules[command];
    definition.commandRules[command] = { ...rule, benefits: { ...rule.benefits }, rewardIds: [...rule.rewardIds], lootboxIds: [...rule.lootboxIds] };
  }
  return { definition, coinsPerMinute: value.coinsPerMinute };
}
export function economyNumber(value: number): string {
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString() : 'Set a value';
}
export function creditedMinutes(cost: number, rate: number): string {
  if (cost === 0) return 'Free';
  if (!Number.isSafeInteger(cost) || cost < 0) return 'Set a fee';
  if (!Number.isSafeInteger(rate) || rate <= 0) return 'No base presence income';
  const minutes = Math.ceil(cost / rate);
  return `${minutes.toLocaleString()} credited ${minutes === 1 ? 'minute' : 'minutes'} at the base rate`;
}
export function lootboxOdds(box: EconomyLootbox, index: number): string {
  if (!box.entries.length || box.entries.some(entry => !Number.isSafeInteger(entry.weight) || entry.weight < 0)) return 'Complete nonnegative weights to preview odds';
  const total = box.entries.reduce((sum, entry) => sum + BigInt(entry.weight), 0n);
  if (total === 0n) return 'At least one outcome needs a positive weight';
  const entry = box.entries[index];
  if (!entry) return 'Outcome unavailable';
  const effective = box.entries.filter(item => item.rewardId === entry.rewardId).reduce((sum, item) => sum + BigInt(item.weight), 0n);
  const aggregate = effective !== BigInt(entry.weight) ? ` · this entry ${entry.weight}/${total}` : '';
  return `≈ ${(Number(effective) / Number(total) * 100).toFixed(2)}% reward chance · weight ${effective}/${total}${aggregate}`;
}
