import { sessionId, sessionObject } from './provider-session-safety';
import { StringDecoder } from 'node:string_decoder';
import { classifyProviderFailure } from '../../features/coforge/application/provider-failure-classification';

const incomplete = () => JSON.stringify({ type: 'result', subtype: 'error_stream_incomplete', is_error: true, errors: ['The provider terminal result was unavailable or ambiguous.'] });
const counters = (value: unknown, keys: readonly string[]) => Object.fromEntries(Object.entries(sessionObject(value)).filter(([key, count]) => keys.includes(key) && typeof count === 'number' && Number.isFinite(count) && count >= 0));
function terminalEnvelope(event: Record<string, unknown>): object {
  const failure = event.is_error ? classifyProviderFailure('claude', { subtype: event.subtype, failureCode: event.coforge_failure_code, errors: event.errors }) : undefined;
  const numeric = Object.fromEntries(['total_cost_usd', 'num_turns', 'duration_ms', 'duration_api_ms'].flatMap(key => event[key] === undefined ? [] : [[key, typeof event[key] === 'number' ? event[key] : null]]));
  const kept = { ...numeric, ...(typeof event.result === 'string' ? { result: event.result } : {}), ...(event.structured_output !== undefined ? { structured_output: event.structured_output } : {}),
    ...(sessionId(event.session_id) ? { session_id: sessionId(event.session_id) } : {}) };
  const models = Object.entries(sessionObject(event.modelUsage)).filter(([key]) => /^[A-Za-z0-9_.:-]{1,160}$/u.test(key));
  return { ...kept, type: 'result', subtype: typeof event.subtype === 'string' && /^[A-Za-z0-9_]{1,100}$/u.test(event.subtype) ? event.subtype : 'error_stream_incomplete',
    is_error: typeof event.is_error === 'boolean' ? event.is_error : true,
    ...(failure ? { coforge_failure_code: failure.code } : {}),
    ...(event.is_error ? { errors: ['The provider reported an unsuccessful result. Check its sign-in and configured limits.'] } : {}),
    ...(event.usage ? { usage: counters(event.usage, ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) } : {}),
    ...(event.modelUsage ? { modelUsage: Object.fromEntries(models.map(([key, value]) => [key, counters(value, ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens', 'costUSD', 'webSearchRequests', 'contextWindow', 'maxOutputTokens'])])) } : {}) };
}
/** Preserve only an actual root result for existing interpretation. Never fall back to publishing a raw transcript. */
export function normalizeClaudeSessionResult(raw: string): string {
  const projection = new ClaudeSessionResult(); projection.append(Buffer.from(raw)); return projection.result();
}

/** Bounded semantic retention is independent of verbose observation volume; no raw transcript is retained. */
export class ClaudeSessionResult {
  private readonly decoder = new StringDecoder('utf8');
  private pending = ''; private dropping = false; private root: string | undefined;
  private terminal: string | undefined; private ambiguous = false;
  constructor(private readonly maxBytes = 2 * 1024 * 1024) {}
  append(chunk: Uint8Array): void {
    for (const part of this.decoder.write(Buffer.from(chunk)).split(/(?<=\n)/u)) {
      if (this.dropping) { if (part.endsWith('\n')) this.dropping = false; continue; }
      if (this.pending.length + part.length > this.maxBytes) { this.pending = ''; this.dropping = !part.endsWith('\n'); if (this.terminal) this.ambiguous = true; continue; }
      this.pending += part;
      if (this.pending.endsWith('\n')) { this.line(this.pending); this.pending = ''; }
    }
  }
  private line(line: string): void {
    let event: Record<string, unknown>; try { event = sessionObject(JSON.parse(line)); } catch { return; }
    if (event.parent_tool_use_id) return;
    const id = sessionId(event.session_id);
    if (!this.root && event.type === 'system' && event.subtype === 'init') this.root = id;
    if (this.root && id && id !== this.root) return;
    if (this.terminal && event.type === 'error') this.ambiguous = true;
    if (event.type !== 'result') return;
    this.root ??= id;
    const next = JSON.stringify(terminalEnvelope(event));
    if (Buffer.byteLength(next) > this.maxBytes) { this.ambiguous = true; return; }
    if (this.terminal && this.terminal !== next) this.ambiguous = true;
    this.terminal = next;
  }
  result(): string {
    if (this.pending && !this.dropping) { this.line(this.pending); this.pending = ''; }
    return !this.ambiguous && this.terminal ? this.terminal : incomplete();
  }
}
