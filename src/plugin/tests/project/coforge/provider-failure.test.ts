import { expect, it } from 'vitest';
import { ProviderFailureError, providerFailureFor, providerFailureInfoCheck, providerFailureMessage } from '../../../features/coforge/domain/provider-failure';
import { classifyProviderFailure } from '../../../features/coforge/application/provider-failure-classification';
import { normalizeClaudeSessionResult } from '../../../infrastructure/coforge/claude-stream-result';
import { parseClaudeEnvelope } from '../../../features/coforge/application/claude-protocol';

it.each([
  ['authentication', '401 Unauthorized invalid_api_key Bearer PRIVATE_CREDENTIAL'],
  ['model_access', 'The requested model is not supported with this account. PRIVATE_MODEL_PAYLOAD'],
  ['rate_limit', '429 Too Many Requests rate_limit_error PRIVATE_RESPONSE'],
  ['capability', "error: unknown option '--private-flag'"],
  ['transport', 'ECONNREFUSED PRIVATE_ENDPOINT'],
] as const)('classifies %s from trusted transport error evidence without retaining its payload', (code, message) => {
  const info = classifyProviderFailure('codex', { message });
  expect(info?.code).toBe(code); expect(info?.nextStep.length).toBeGreaterThan(20);
  expect(JSON.stringify(info)).not.toMatch(/PRIVATE_|Bearer|private-flag/u);
});

it('keeps unknown causes unknown and rejects forged public diagnostic text', () => {
  expect(classifyProviderFailure('claude', { message: 'Unrecognized provider failure' })).toBeUndefined();
  const info = providerFailureFor('authentication');
  expect(() => providerFailureInfoCheck({ ...info, summary: 'PRIVATE_DIAGNOSTIC' })).toThrow();
  expect(providerFailureMessage(providerFailureFor('authentication', true), true)).toMatch(/quarantin|unverified/u);
  expect(providerFailureFor('authentication', true).nextStep).toMatch(/original execution|stopped/u);
});
it('does not infer account failures from model result prose or incidental path text', () => {
  expect(classifyProviderFailure('claude', { message: '/private/authentication_error/rate_limit_error/report' })).toBeUndefined();
  const raw = normalizeClaudeSessionResult(JSON.stringify({ type: 'result', subtype: 'error_max_structured_output_retries', is_error: true,
    result: 'Authentication failed 401 Unauthorized', structured_output: { text: 'rate_limit_error' } }));
  expect(JSON.parse(raw).coforge_failure_code).toBe('output_validation');
});

it('classifies a genuine Claude failure before stream normalization removes unsafe error payloads', () => {
  const raw = normalizeClaudeSessionResult(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true,
    errors: ['401 Unauthorized: invalid_api_key Bearer PRIVATE_CREDENTIAL /private/auth.json'], total_cost_usd: 0.25 }));
  expect(raw).not.toContain('PRIVATE_CREDENTIAL'); expect(raw).not.toContain('/private/auth.json');
  expect(JSON.parse(raw).coforge_failure_code).toBe('authentication');
  try { parseClaudeEnvelope(raw); } catch (error) {
    expect(error).toBeInstanceOf(ProviderFailureError); expect(error instanceof ProviderFailureError && error.failure.code).toBe('authentication');
    expect(error instanceof Error && error.message).toContain('sign-in'); return;
  }
  throw new Error('A failed provider envelope unexpectedly succeeded');
});

it.each([['error_max_turns', 'turn_limit'], ['error_max_budget_usd', 'budget_limit'], ['error_max_structured_output_retries', 'output_validation']] as const)
('retains the specific %s cause and next step', (subtype, code) => {
  const info = classifyProviderFailure('claude', { subtype }); expect(info?.code).toBe(code);
});
