import { record } from '../domain/check';

/** Installed CLI reconnect progress is nonterminal only before a later valid root completion. */
export function codexReconnectNotice(event: Record<string, unknown>): boolean {
  return event.type === 'error' && typeof event.message === 'string'
    && /^Reconnecting\.\.\. [1-5]\/5 \(stream disconnected before completion: [^\r\n]+\)$/u.test(event.message);
}

function agentName(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const agent = record(value);
    if (typeof agent.agent_name === 'string') return agent.agent_name;
  }
  return undefined;
}

/** Exec stdout is the primary thread's channel. Explicit descendant/foreign attribution never becomes root evidence. */
export class CodexEventScope {
  private rootThreadId: string | undefined;
  private identified = false;
  get hasRootIdentity(): boolean { return this.identified; }
  accepts(event: Record<string, unknown>): boolean {
    const item = event.item && typeof event.item === 'object' && !Array.isArray(event.item) ? record(event.item) : {};
    for (const owner of [event, item]) {
      if (owner.parent_thread_id !== undefined && owner.parent_thread_id !== null) return false;
      for (const key of ['agent', 'agent_name']) {
        if (owner[key] === undefined) continue;
        const name = agentName(owner[key]);
        if (name !== '/root') return false;
        this.identified = true;
      }
    }
    const threadIds = [event.thread_id, item.thread_id].filter((id): id is string => typeof id === 'string');
    const threadId = threadIds[0];
    if (event.type === 'thread.started' && threadId && !this.rootThreadId) {
      this.rootThreadId = threadId; this.identified = true;
    }
    if (threadIds.some(id => id !== this.rootThreadId)) return false;
    return true;
  }
}

export function rootCodexEvents(raw: string): { events: Record<string, unknown>[]; hasRootIdentity: boolean } {
  const scope = new CodexEventScope();
  const events = raw.trim().split(/\r?\n/u).filter(Boolean).map(line => record(JSON.parse(line))).filter(event => scope.accepts(event));
  return { events, hasRootIdentity: scope.hasRootIdentity };
}
