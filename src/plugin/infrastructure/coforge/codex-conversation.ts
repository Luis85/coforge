import type { AgentConversationEvent } from '../../features/coforge/domain/agent-conversation';
import { redact } from './process';
import { CodexEventScope } from '../../features/coforge/application/codex-events';
import { record } from '../../features/coforge/domain/check';
import { persistProviderEvidence } from './provider-evidence';

/** Extract only completed, user-visible assistant messages; never retain the raw event stream or reasoning. */
export async function captureCodexResponse(
  capture: ((event: AgentConversationEvent) => Promise<void>) | undefined,
  raw: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  if (!capture) return;
  const messages: string[] = [];
  const scope = new CodexEventScope();
  for (const line of raw.split(/\r?\n/u)) {
    let event: unknown;
    try { event = JSON.parse(line); } catch { continue; }
    if (!event || typeof event !== 'object' || Array.isArray(event) || !scope.accepts(record(event)) || !('type' in event) || event.type !== 'item.completed' || !('item' in event)) continue;
    const item = event.item;
    if (!item || typeof item !== 'object' || !('type' in item) || item.type !== 'agent_message' || !('text' in item) || typeof item.text !== 'string') continue;
    messages.push(item.text);
  }
  if (!messages.length) return;
  const text = messages.length === 1 ? messages[0]! : JSON.stringify({ messages }, null, 2);
  await persistProviderEvidence(() => capture({ kind: 'response', text: redact(text, { ...process.env, ...environment }) }));
}
