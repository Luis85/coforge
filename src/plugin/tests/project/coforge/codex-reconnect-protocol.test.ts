import { expect, it } from 'vitest';
import { codexResult } from '../../../features/coforge/application/codex-protocol';
import { ProviderOutput } from '../../../infrastructure/coforge/durable-worker/output';

const start = { type: 'thread.started', thread_id: 'root' };
const reconnect = { type: 'error', message: 'Reconnecting... 2/5 (stream disconnected before completion: websocket closed by server before response.completed)' };
const message = { type: 'item.completed', item: { type: 'agent_message', text: '{"summary":"Completed after CLI stream recovery"}' } };
const complete = { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 5 } };
const stream = (...events: object[]) => events.map(event => JSON.stringify(event)).join('\n');
function projected(raw: string): string {
  const output = new ProviderOutput(true);
  for (let index = 0; index < raw.length; index += 13) output.append(Buffer.from(raw.slice(index, index + 13)));
  return output.result();
}

it.each(['foreground', 'durable'] as const)('accepts %s valid root completion after the installed CLI nonterminal reconnect notice', mode => {
  const raw = stream(start, reconnect, message, complete);
  expect(codexResult(mode === 'durable' ? projected(raw) : raw, { delegated: true })).toMatchObject({ output: { summary: 'Completed after CLI stream recovery' } });
});

it.each(['no completion', 'fatal before completion', 'turn failed', 'late error', 'late error then another completion', 'unrecognized counter'] as const)('keeps %s fatal in foreground and bounded durable evidence', reason => {
  let events: object[];
  if (reason === 'no completion') events = [start, reconnect, message];
  else if (reason === 'fatal before completion') events = [start, { type: 'error', message: 'Authentication failed' }, message, complete];
  else if (reason === 'turn failed') events = [start, { type: 'turn.failed' }, message, complete];
  else if (reason === 'late error') events = [start, message, complete, reconnect];
  else if (reason === 'late error then another completion') events = [start, message, complete, reconnect, { ...complete, usage: { ...complete.usage, output_tokens: 6 } }];
  else events = [start, { ...reconnect, message: reconnect.message.replace('2/5', '6/5') }, message, complete];
  const raw = stream(...events);
  expect(() => codexResult(raw, { delegated: true })).toThrow();
  expect(() => codexResult(projected(raw), { delegated: true })).toThrow();
});

it('does not let an attributed child failure alter the root reconnect classification', () => {
  const raw = stream(start, reconnect, { type: 'turn.failed', agent: { agent_name: '/root/child' } }, message, complete);
  expect(codexResult(raw, { delegated: true })).toMatchObject({ output: { summary: 'Completed after CLI stream recovery' } });
});
