import { CheckError, oneOf, shape, text, type Check } from './check';

export const PROVIDER_FAILURE_CODES = ['installation', 'authentication', 'model_access', 'access_denied', 'rate_limit', 'turn_limit', 'budget_limit', 'tool_limit', 'capability', 'configuration', 'output_validation', 'incomplete_output', 'transport', 'cancelled', 'timeout', 'ownership_unknown', 'provider_error', 'execution_failed', 'persistence', 'workspace_validation', 'native_platform', 'native_elevation', 'native_controller'] as const;
export type ProviderFailureCode = typeof PROVIDER_FAILURE_CODES[number];
export interface ProviderFailureInfo { readonly code: ProviderFailureCode; readonly summary: string; readonly nextStep: string }
export const providerFailureCodeCheck = oneOf(PROVIDER_FAILURE_CODES);
const review = 'Review any partial worktree changes before an explicit retry.';
const catalogue: Record<ProviderFailureCode, readonly [string, string]> = {
  installation: ['The configured native provider could not start.', 'Check the configured native executable and its installed version. No permissive or alternate-provider fallback is used.'],
  authentication: ['The provider could not authenticate this attempt.', `Check its normal CLI sign-in or configured API-key environment. ${review}`],
  model_access: ['The selected model was unavailable or was not permitted for this attempt.', `Check the selected model against the signed-in account. Explicitly select an available model; no model is substituted. ${review}`],
  access_denied: ['The provider denied access to this request.', `Check the signed-in account and provider access policy. ${review}`],
  rate_limit: ['The provider reported a rate or capacity limit.', `Check provider availability and account limits; wait before explicitly retrying. ${review}`],
  turn_limit: ['The provider reached the configured turn limit before completing.', 'Review any partial worktree changes, then update workflow turn-limit settings for a new attempt. The captured attempt is unchanged.'],
  budget_limit: ['The provider reached the configured USD budget before completing.', 'Review reported usage and any partial worktree changes, then update workflow budget settings for a new attempt. The captured attempt is unchanged.'],
  tool_limit: ['The attempt reached its captured tool-call or verification-run limit.', `Review recorded tool and verification outcomes, then adjust the appropriate limit before an explicit retry. ${review}`],
  capability: ['The installed provider does not expose the required restricted capabilities.', 'Check the configured native CLI version and selected model capabilities. Update the CLI or explicitly change the workflow; no permissive fallback is used.'],
  configuration: ['The provider could not load the captured execution configuration.', `Check its normal CLI configuration and selected model catalogue. ${review}`],
  output_validation: ['The provider did not return the required structured result.', `Review the result contract and any partial worktree changes before an explicit retry.`],
  incomplete_output: ['The provider did not emit a verifiable terminal result.', `Inspect the recorded sessions and any partial worktree changes. Confirm the original execution has stopped before explicitly retrying.`],
  transport: ['The provider connection failed before this attempt completed.', `Check connectivity and provider availability. ${review}`],
  cancelled: ['The attempt was cancelled.', 'Inspect retained changes and original execution status before deciding whether to start another attempt.'],
  timeout: ['The captured execution deadline elapsed before completion.', 'Inspect retained changes and confirm original execution recovery; then review the deadline before explicitly starting another attempt.'],
  ownership_unknown: ['Original execution or resource ownership is unverified.', 'Check the original execution and confirm it has stopped before releasing its workspace or explicitly starting another attempt.'],
  provider_error: ['The provider reported an execution failure.', 'The specific cause was not established. Inspect recorded sessions, normal CLI status and any partial worktree changes before an explicit retry.'],
  execution_failed: ['The attempt did not complete; its specific cause was not established.', 'Inspect the retained conversation, original execution and any partial worktree changes before explicitly starting another attempt.'],
  persistence: ['The attempt’s execution evidence could not be saved.', 'Check execution-data storage, available disk space and write permissions. Review this attempt’s original execution and retained changes before starting another attempt.'],
  workspace_validation: ['The original workspace could not be validated for this attempt.', 'Inspect this attempt’s original workspace and retained changes. Restore its verified ownership before explicitly starting another attempt.'],
  native_platform: ['Owned native coding is not qualified on this platform.', 'Use a supported Windows desktop. No unowned or alternate-platform fallback was started.'],
  native_elevation: ['Native coding was blocked because the host is elevated.', 'Restart the host without elevation under your normal desktop account, then explicitly retry. No command was started.'],
  native_controller: ['The Windows native process controller could not be prepared.', 'Check local runtime and file permissions, then restart the host before explicitly retrying. No unowned fallback was started.'],
};
const ownershipNextStep = 'First check the original execution and confirm it has stopped. ';
export function providerFailureFor(code: ProviderFailureCode, ownershipUnknown = false): ProviderFailureInfo {
  const [summary, nextStep] = catalogue[code];
  return { code, summary, nextStep: ownershipUnknown && code !== 'ownership_unknown' ? ownershipNextStep + nextStep : nextStep };
}
const fields = shape({ code: providerFailureCodeCheck, summary: text({ min: 1, max: 400 }), nextStep: text({ min: 1, max: 1000 }) }, { strict: true });
/** Public failure details contain fixed catalogue text only, never transport snippets or arbitrary stored messages. */
export const providerFailureInfoCheck: Check<ProviderFailureInfo> = (value, path) => {
  const checked = fields(value, path), normal = providerFailureFor(checked.code), uncertain = providerFailureFor(checked.code, true);
  if (checked.summary !== normal.summary || checked.nextStep !== normal.nextStep && checked.nextStep !== uncertain.nextStep) throw new CheckError(path ?? '', 'failure details are not from the safe catalogue');
  return checked;
};
/** Uncertainty survives persistence through its validated catalogue variant, never arbitrary error prose. */
export function safeFailureHasUnknownOwnership(info: ProviderFailureInfo | undefined): boolean {
  if (!info) return false;
  const checked = providerFailureInfoCheck(info);
  return checked.code === 'ownership_unknown' || checked.nextStep !== providerFailureFor(checked.code).nextStep;
}
export function providerFailureInfo(error: unknown): ProviderFailureInfo | undefined {
  try { if (error && typeof error === 'object' && 'failure' in error) return providerFailureInfoCheck(error.failure); } catch { /* Unknown errors never become invented causes. */ }
  return undefined;
}
export function providerFailureMessage(info: ProviderFailureInfo, ownershipUnknown = false): string {
  const value = providerFailureInfoCheck(info);
  const uncertain = ownershipUnknown || value.code === 'ownership_unknown' || value.nextStep !== providerFailureFor(value.code).nextStep;
  return `${value.summary}${uncertain ? ' Original execution ownership remains unverified; its workspace is quarantined.' : ''} ${value.nextStep}`;
}
export function assignProviderFailure<T extends Error>(error: T, info: ProviderFailureInfo): T {
  Object.defineProperty(error, 'failure', { value: providerFailureInfoCheck(info), enumerable: true, configurable: true });
  return error;
}
export class ProviderFailureError extends Error {
  constructor(readonly failure: ProviderFailureInfo) { super(providerFailureMessage(failure)); this.name = 'ProviderFailureError'; }
}
