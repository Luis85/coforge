import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';
import { setTimeout, clearTimeout } from 'node:timers';

/** Best-effort display persistence is finite and cannot control execution or retry work. Callers supply sanitized observations. */
export function boundedSessionSink(capture?: (event: AgentSessionEvent) => Promise<void>): { emit(event: AgentSessionEvent): void; lost(): void; finish(): Promise<void> } {
  if (!capture) return { emit: () => {}, lost: () => {}, finish: async () => {} };
  const queue: AgentSessionEvent[] = []; let active: Promise<void> | undefined; let closed = false; let incomplete = false;
  const run = () => {
    if (active || closed) return;
    active = (async () => { while (queue.length && !closed) { const event = queue.shift()!; try { await capture(event); } catch { incomplete = true; } } })()
      .finally(() => { active = undefined; if (queue.length && !closed) run(); });
  };
  return {
    emit: event => { if (closed) return; if (queue.length >= 64) { incomplete = true; return; } queue.push(event); run(); },
    lost: () => { incomplete = true; },
    finish: async () => {
      if (closed) return;
      if (active) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([active, new Promise<void>(resolve => { timer = setTimeout(resolve, 250); })]);
        if (timer) clearTimeout(timer);
      }
      if (active || queue.length) incomplete = true;
      if (incomplete) { try { void capture({ kind: 'notice', status: 'unknown', text: 'Some session observations were unavailable or omitted; this display is incomplete.' }).catch(() => {}); } catch { /* Observation loss never changes execution. */ } }
      closed = true; queue.splice(0);
    },
  };
}
