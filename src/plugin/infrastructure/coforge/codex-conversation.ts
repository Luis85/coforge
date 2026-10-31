import type { AgentConversationEvent } from '../../features/coforge/domain/agent-conversation';
import { redact } from './process';

/** Extract only completed, user-visible assistant messages; never retain the raw event stream or reasoning. */
export async function captureCodexResponse(
  capture: ((event: AgentConversationEvent) => Promise<void>) | undefined,
  raw: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  if (!capture) return;
  const messages: string[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    let event: unknown;
    try { event = JSON.parse(line); } catch { continue; }
    if (!event || typeof event !== 'object' || !('type' in event) || event.type !== 'item.completed' || !('item' in event)) continue;
    const item = event.item;
    if (!item || typeof item !== 'object' || !('type' in item) || item.type !== 'agent_message' || !('text' in item) || typeof item.text !== 'string') continue;
    messages.push(item.text);
  }
  if (!messages.length) return;
  const text = messages.length === 1 ? messages[0]! : JSON.stringify({ messages }, null, 2);
  await capture({ kind: 'response', text: redact(text, { ...process.env, ...environment }) });
}
