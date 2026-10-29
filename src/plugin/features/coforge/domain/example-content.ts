import { CheckError, oneOf, record, text, timestamp } from './check';

export type RequestOrigin = 'sample' | 'local-test' | 'manual' | 'twitch' | 'api';
const origin = oneOf(['sample', 'local-test', 'manual', 'twitch', 'api'] as const);
const requestId = text({ pattern: /^CF-\d{3,7}$/ });

/** Private intake evidence; absent legacy provenance stays unknown instead of being guessed. */
export function requestOriginsCheck(value: unknown): Record<string, RequestOrigin> {
  return Object.fromEntries(Object.entries(record(value)).map(([id, entry]) => [requestId(id), origin(entry)]));
}

/** Keep removal generations durable: reused sample IDs may have newer, retained attempts. */
export function exampleRemovalCutoffsCheck(value: unknown): Record<string, string> {
  const entries = Object.entries(record(value));
  if (entries.length > 100000) throw new CheckError('exampleRemovalCutoffs', 'allows at most 100000 request generations');
  return Object.fromEntries(entries.map(([id, at]) => [requestId(id), timestamp(at)]));
}
