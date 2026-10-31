import { CheckError, oneOf } from './check';
import type { Provider } from './types';

export const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = typeof REASONING_EFFORTS[number];
export const reasoningEffortCheck = oneOf(REASONING_EFFORTS);
export interface ProviderModel { value: string; label: string; efforts: readonly ReasoningEffort[] }
const standard = ['low', 'medium', 'high', 'max'] as const;
// Codex identity is checked against its installed catalogue at dispatch. Ultra delegates natively and is not offered.
const codexModels: readonly ProviderModel[] = ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna'].map(value => ({ value, label: value, efforts: REASONING_EFFORTS }));
/** Documented Claude Code choices, checked 2026-10-30. Account/provider policy still applies.
 * https://code.claude.com/docs/en/model-config#adjust-effort-level
 * Aliases resolve in the installed CLI and may be pinned by the operator.
 */
const claudeModels: readonly ProviderModel[] = [
  ...['sonnet', 'opus', 'haiku', 'fable', 'best'].map(value => ({ value, label: `${value[0]!.toUpperCase()}${value.slice(1)} · CLI alias`, efforts: REASONING_EFFORTS })),
  ...['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-opus-4-7'].map(value => ({ value, label: value, efforts: REASONING_EFFORTS })),
  ...['claude-sonnet-4-6', 'claude-opus-4-6'].map(value => ({ value, label: value, efforts: standard })),
  { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5', efforts: [] },
];
export function providerModels(provider: Provider): readonly ProviderModel[] {
  return provider === 'demo' ? [] : provider === 'codex' ? codexModels : claudeModels;
}
export function modelEfforts(provider: Provider, model: string | undefined): readonly ReasoningEffort[] {
  if (provider === 'demo' || !model) return [];
  const models = providerModels(provider);
  const known = models.find(item => item.value === model);
  if (known) return known.efforts;
  // Dated Claude IDs have the same capabilities as their base model.
  return models.find(item => model.replace(/-\d{8}$/u, '') === item.value)?.efforts ?? [];
}
export function validateModelEffort(choice: { provider: Provider; model: string; effort?: ReasoningEffort }): void {
  if (choice.effort !== undefined && !modelEfforts(choice.provider, choice.model).includes(reasoningEffortCheck(choice.effort)))
    throw new CheckError('effort', 'The selected model does not support this reasoning effort. Choose the provider default or a supported effort.');
}
