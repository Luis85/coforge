import { StringDecoder } from 'node:string_decoder';
import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';
import { codexSessionEvents } from './codex-session-events';
import { claudeSessionEvents } from './claude-session-events';
import { sessionObject, sessionSanitizer, sessionTextSanitizer } from './provider-session-safety';
import { boundedSessionSink } from './session-observation-sink';

export interface ProviderSessionObserverInput {
  provider: 'codex' | 'claude'; capture?: (event: AgentSessionEvent) => Promise<void>;
  environment?: NodeJS.ProcessEnv; privatePaths?: readonly string[];
}
/** Internal raw bytes are never published. Complete allowlisted observations use a bounded, non-authoritative sink. */
export function providerSessionObserver(input: ProviderSessionObserverInput): { push(chunk: Uint8Array): void; finish(): Promise<void> } {
  if (!input.capture) return { push: () => {}, finish: async () => {} };
  const sanitize = sessionSanitizer(input.environment, input.privatePaths), sink = boundedSessionSink(input.capture);
  const textSanitize = sessionTextSanitizer(input.environment, input.privatePaths);
  let closed = false;
  const emit = (event: AgentSessionEvent) => {
    const safe = sanitize(event); sink.emit(safe);
    if (event.kind === 'message' && event.text && textSanitize(event.text, 65536).length > 2048)
      sink.emit({ kind: 'notice', ...(safe.sessionId ? { sessionId: safe.sessionId } : {}), text: 'This assistant message was truncated for the bounded display. Inspect the saved result for the complete output.' });
  };
  const accept = input.provider === 'codex' ? codexSessionEvents(emit) : claudeSessionEvents(emit);
  const decoder = new StringDecoder('utf8'); let pending = ''; let skipping = false;
  const line = (value: string) => { if (!value.trim()) return; try { accept(sessionObject(JSON.parse(value))); } catch { sink.lost(); } };
  const text = (value: string) => {
    for (const part of value.split(/(?<=\n)/u)) {
      if (skipping) { if (part.endsWith('\n')) skipping = false; continue; }
      if (pending.length + part.length > 65536) { pending = ''; skipping = !part.endsWith('\n'); sink.lost(); continue; }
      pending += part;
      if (pending.endsWith('\n')) { line(pending); pending = ''; }
    }
  };
  return {
    push: chunk => { if (!closed) { try { text(decoder.write(Buffer.from(chunk))); } catch { sink.lost(); } } },
    finish: async () => {
      if (closed) return;
      text(decoder.end()); if (pending && !skipping) line(pending); pending = '';
      await sink.finish(); closed = true;
    },
  };
}
