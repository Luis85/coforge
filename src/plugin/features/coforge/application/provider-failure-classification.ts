import { providerFailureCodeCheck, providerFailureFor, type ProviderFailureInfo } from '../domain/provider-failure';

export interface ProviderFailureEvidence { subtype?: unknown; code?: unknown; message?: unknown; errors?: unknown; failureCode?: unknown }
/** Classify only trusted provider error fields or a private transport diagnostic. Never return their text. */
export function classifyProviderFailure(provider: 'claude' | 'codex', evidence: ProviderFailureEvidence): ProviderFailureInfo | undefined {
  if (evidence.failureCode !== undefined) { try { return providerFailureFor(providerFailureCodeCheck(evidence.failureCode)); } catch { /* Unrecognized codes carry no diagnosis. */ } }
  const subtype = evidence.subtype;
  if (provider === 'claude') {
    if (subtype === 'error_max_turns') return providerFailureFor('turn_limit');
    if (subtype === 'error_max_budget_usd') return providerFailureFor('budget_limit');
    if (subtype === 'error_max_structured_output_retries') return providerFailureFor('output_validation');
  }
  if (subtype === 'error_stream_incomplete') return providerFailureFor('incomplete_output');
  const strings: string[] = [], codes: string[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (strings.length >= 16 || depth > 3) return;
    if (typeof value === 'string') strings.push(value.slice(0, 8192));
    else if (Array.isArray(value)) value.slice(0, 16).forEach(item => visit(item, depth + 1));
    else if (value && typeof value === 'object') for (const key of ['code', 'type', 'message', 'error', 'errors']) if (key in value) {
      const nested: unknown = Reflect.get(value, key); if ((key === 'code' || key === 'type') && typeof nested === 'string') codes.push(nested); else visit(nested, depth + 1);
    }
  };
  if (typeof evidence.code === 'string') codes.push(evidence.code);
  visit(evidence.code); visit(evidence.message); visit(evidence.errors);
  const message = strings.join('\n');
  if (codes.some(code => ['invalid_api_key', 'authentication_error'].includes(code)) || /401\s+(?:Unauthorized|authorization)|^(?:(?:API )?Error:\s*)?(?:invalid_api_key|authentication_error|(?:authentication|sign.in|oauth|refresh.token).{0,60}(?:fail|expired|invalid|revoked)|not.logged.in)/imu.test(message)) return providerFailureFor('authentication');
  if (codes.includes('model_not_found') || /^(?:(?:API )?Error:\s*)?(?:model_not_found|(?:The (?:requested|selected) )?model(?:[ :]|.id).{0,100}(?:not (?:available|supported|found|permitted)|unavailable|does not exist|access.denied))/imu.test(message)) return providerFailureFor('model_access');
  if (codes.some(code => ['rate_limit_error', 'overloaded_error', 'insufficient_quota'].includes(code)) || /429\s+(?:Too Many|rate)|^(?:(?:API )?Error:\s*)?(?:(?:rate|capacity).limit|rate_limit_error|overloaded_error|insufficient_quota)/imu.test(message)) return providerFailureFor('rate_limit');
  if (/403\s+Forbidden|permission_error/iu.test(message)) return providerFailureFor('access_denied');
  if (/unknown (?:option|argument)|unrecognized (?:option|argument)|unsupported (?:option|flag|capability)|required.*flag.*not.support/iu.test(message)) return providerFailureFor('capability');
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|network.error|connection.(?:failed|refused|reset)|stream.disconnected/iu.test(message)) return providerFailureFor('transport');
  if (subtype === 'error_during_execution') return providerFailureFor('provider_error');
  return undefined;
}
