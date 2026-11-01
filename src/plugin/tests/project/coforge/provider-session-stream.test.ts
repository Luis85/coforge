import { describe, expect, it } from 'vitest';
import type { AgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import { providerSessionObserver } from '../../../infrastructure/coforge/provider-session-stream';
import { sessionTextSanitizer } from '../../../infrastructure/coforge/provider-session-safety';

const line = (event: object) => JSON.stringify(event) + '\n';
function fixture(provider: 'codex' | 'claude', environment: NodeJS.ProcessEnv = {}) {
  const events: AgentSessionEvent[] = [];
  const observer = providerSessionObserver({ provider, environment, privatePaths: ['C:/private/runtime'], capture: async event => { events.push(event); } });
  return { events, observer };
}
describe('sanitized provider session stream', () => {
  it('normalizes invisible/fullwidth credentials before redacting complete text and only then clips display chunks', () => {
    const safe = sessionTextSanitizer({ TEST_API_KEY: 'known-secret-value' });
    for (const value of ['Bea\u200brer UNKNOWN_TOKEN', 'Ｂｅａｒｅｒ UNKNOWN_TOKEN', 'known-\u200bsecret-value']) {
      const result = safe(value, 8192);
      expect(result).not.toContain('UNKNOWN_TOKEN'); expect(result).not.toContain('known-secret-value');
    }
    expect(safe('x'.repeat(2042) + 'known-\u200bsecret-value', 2048)).not.toContain('known-');
  });
  it('redacts arbitrary absolute Unix roots and file URIs while preserving ordinary URLs and repository-relative paths', () => {
    const safe = sessionTextSanitizer();
    const value = safe('Paths /opt/private/auth.json /srv/project/file /data/repo file:///etc/private/key and https://example.com/docs src/game.ts');
    for (const path of ['/opt/private', '/srv/project', '/data/repo', 'file:///etc']) expect(value).not.toContain(path);
    expect(value).toContain('https://example.com/docs'); expect(value).toContain('src/game.ts');
  });
  it('decodes split UTF8/JSON and redacts credentials across transport chunks before publishing complete messages', async () => {
    const f = fixture('codex', { TEST_API_KEY: 'split-secret-value' });
    const bytes = Buffer.from(line({ type: 'thread.started', thread_id: 'root-1' }) + line({ type: 'item.completed', item: { type: 'agent_message', text: 'Done 🎮 split-secret-value Bearer opaque-value C:/private/runtime/broker.json' } }));
    for (const byte of bytes) f.observer.push(Uint8Array.of(byte));
    await f.observer.finish();
    const message = f.events.find(event => event.kind === 'message');
    expect(message?.sessionId).toBe('root-1'); expect(message?.text).toContain('🎮');
    expect(message?.text).not.toContain('�'); expect(message?.text).not.toContain('split-secret');
    expect(message?.text).not.toContain('opaque-value'); expect(message?.text).not.toContain('private/runtime');
  });

  it('retains tool names/status only and excludes prompts, arguments, reasoning and arbitrary JSON', async () => {
    const f = fixture('codex');
    f.observer.push(Buffer.from(line({ type: 'thread.started', thread_id: 'root-1', instructions: 'GLOBAL_PROMPT' })
      + line({ type: 'item.completed', item: { id: 'tool-1', type: 'mcp_tool_call', tool: 'coforge_read_file', server: 'coforge', arguments: { path: 'SECRET_ARGUMENT' }, result: 'RAW_TOOL_RESULT' } })
      + line({ type: 'item.completed', item: { type: 'reasoning', text: 'HIDDEN_REASONING' } })
      + line({ type: 'unknown', text: 'ARBITRARY_JSON' }) + line({ type: 'turn.completed' })));
    await f.observer.finish();
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'tool', tool: 'coforge_read_file', sessionId: 'root-1', status: 'completed' }));
    for (const forbidden of ['GLOBAL_PROMPT', 'SECRET_ARGUMENT', 'RAW_TOOL_RESULT', 'HIDDEN_REASONING', 'ARBITRARY_JSON']) expect(JSON.stringify(f.events)).not.toContain(forbidden);
  });

  it('sanitizes adjacent complete Claude text blocks before publishing their combined message', async () => {
    const f = fixture('claude', { TEST_API_KEY: 'credential-across-blocks' });
    f.observer.push(Buffer.from(line({ type: 'assistant', session_id: 'root-1', message: { content: [{ type: 'text', text: 'credential-across-' }, { type: 'text', text: 'blocks' }] } })));
    await f.observer.finish(); expect(JSON.stringify(f.events)).not.toContain('credential-across-');
  });
  it('discloses actual safe-text truncation on the same child association without flagging ordinary redaction shortening', async () => {
    const f = fixture('claude', { TEST_API_KEY: 'long-secret-value-that-is-shortened' });
    f.observer.push(Buffer.from(line({ type: 'system', subtype: 'init', session_id: 'root-1' })
      + line({ type: 'assistant', session_id: 'root-1', parent_tool_use_id: 'toolu_child', message: { content: [{ type: 'text', text: 'Visible answer '.repeat(250) }] } })
      + line({ type: 'assistant', session_id: 'root-1', message: { content: [{ type: 'text', text: 'long-secret-value-that-is-shortened '.repeat(80) }] } })));
    await f.observer.finish();
    const notices = f.events.filter(event => event.kind === 'notice' && /truncated/u.test(event.text ?? ''));
    expect(notices).toHaveLength(1); expect(notices[0]?.sessionId).toBe('claude-tool:toolu_child');
    expect(f.events.filter(event => event.kind === 'message').every(event => (event.text?.length ?? 0) <= 2048)).toBe(true);
  });

  it('uses emitted child IDs and explicit parentage while keeping missing Codex child detail honest', async () => {
    const f = fixture('codex');
    f.observer.push(Buffer.from(line({ type: 'thread.started', thread_id: 'root-1' })
      + line({ type: 'thread.started', thread_id: 'child-1', parent_thread_id: 'root-1' })
      + line({ type: 'item.completed', thread_id: 'child-1', parent_thread_id: 'root-1', item: { type: 'agent_message', text: 'Child visible answer' } })
      + line({ type: 'item.completed', item: { type: 'collab_tool_call', tool: 'wait', receiver_thread_ids: [], agents_states: {}, prompt: 'PRIVATE_CHILD_TASK' } })
      + line({ type: 'item.completed', thread_id: 'foreign-root', item: { type: 'agent_message', text: 'FOREIGN_MESSAGE' } })));
    await f.observer.finish();
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'session', sessionId: 'child-1', parentSessionId: 'root-1' }));
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'message', sessionId: 'child-1', text: 'Child visible answer' }));
    expect(f.events.some(event => event.kind === 'notice' && /unavailable/u.test(event.text ?? ''))).toBe(true);
    expect(JSON.stringify(f.events)).not.toContain('PRIVATE_CHILD_TASK'); expect(JSON.stringify(f.events)).not.toContain('FOREIGN_MESSAGE');
  });
  it('never adopts requested foreign Codex recipients from rejected native calls as children', async () => {
    const f = fixture('codex');
    f.observer.push(Buffer.from(line({ type: 'thread.started', thread_id: 'root-1' })
      + line({ type: 'item.started', item: { type: 'collab_tool_call', tool: 'send_message', receiver_thread_ids: ['foreign-1'], status: 'in_progress' } })
      + line({ type: 'item.completed', item: { type: 'collab_tool_call', tool: 'send_message', receiver_thread_ids: ['foreign-1'], status: 'failed' } })
      + line({ type: 'item.completed', thread_id: 'foreign-1', item: { type: 'agent_message', text: 'FOREIGN_MESSAGE' } })
      + line({ type: 'item.completed', item: { type: 'collab_tool_call', tool: 'spawn_agent', receiver_thread_ids: ['child-real'], status: 'completed' } })));
    await f.observer.finish();
    expect(f.events.some(event => event.sessionId === 'foreign-1')).toBe(false);
    expect(JSON.stringify(f.events)).not.toContain('FOREIGN_MESSAGE');
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'session', sessionId: 'child-real', parentSessionId: 'root-1', status: 'running' }));
  });

  it('correlates Claude children by Agent tool ID when the SDK repeats the root session ID', async () => {
    const f = fixture('claude');
    f.observer.push(Buffer.from(line({ type: 'system', subtype: 'init', session_id: 'root-claude', tools: ['GLOBAL_TOOL_CONFIGURATION'] })
      + line({ type: 'assistant', session_id: 'root-claude', parent_tool_use_id: null, message: { content: [{ type: 'tool_use', id: 'toolu_child', name: 'Agent', input: { prompt: 'SECRET_CHILD_PROMPT' } }] } })
      + line({ type: 'assistant', session_id: 'root-claude', parent_tool_use_id: 'toolu_child', message: { content: [{ type: 'thinking', thinking: 'SECRET_REASONING' }, { type: 'text', text: 'Child answer' }, { type: 'tool_use', id: 'toolu_read', name: 'coforge_read_file', input: { path: 'SECRET_PATH' } }] } })
      + line({ type: 'system', subtype: 'task_notification', session_id: 'root-claude', tool_use_id: 'toolu_child', status: 'completed', output_file: 'PRIVATE_TRANSCRIPT' })
      + line({ type: 'result', session_id: 'root-claude', is_error: false, subtype: 'success', result: 'Root answer', structured_output: { summary: 'Do not dump arbitrary JSON' } })));
    await f.observer.finish();
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'session', sessionId: 'claude-tool:toolu_child', parentSessionId: 'root-claude', status: 'running' }));
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'message', sessionId: 'claude-tool:toolu_child', text: 'Child answer' }));
    expect(f.events).toContainEqual(expect.objectContaining({ kind: 'session', sessionId: 'claude-tool:toolu_child', status: 'completed' }));
    for (const hidden of ['GLOBAL_TOOL_CONFIGURATION', 'SECRET_', 'PRIVATE_TRANSCRIPT', 'Do not dump']) expect(JSON.stringify(f.events)).not.toContain(hidden);
  });
  it('keeps requested Claude Agent work queued until actual activity and records a denied request as failed', async () => {
    const f = fixture('claude');
    f.observer.push(Buffer.from(line({ type: 'assistant', session_id: 'root-1', message: { content: [{ type: 'tool_use', id: 'toolu_denied', name: 'Agent', input: { prompt: 'PRIVATE_TASK' } }] } })
      + line({ type: 'user', session_id: 'root-1', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_denied', is_error: true, content: 'PRIVATE_ERROR' }] } })));
    await f.observer.finish();
    const statuses = f.events.filter(event => event.kind === 'session' && event.sessionId === 'claude-tool:toolu_denied').map(event => event.status);
    expect(statuses).toEqual(['queued', 'failed']); expect(JSON.stringify(f.events)).not.toContain('PRIVATE_');
  });

  it('drops oversized or malformed lines, recovers at the next boundary and reports incomplete capture', async () => {
    const f = fixture('codex');
    f.observer.push(Buffer.from('x'.repeat(100000)));
    f.observer.push(Buffer.from('\nnot-json\n' + line({ type: 'thread.started', thread_id: 'root-1' })));
    await f.observer.finish();
    expect(f.events.some(event => event.kind === 'notice')).toBe(true);
    expect(f.events).toContainEqual(expect.objectContaining({ sessionId: 'root-1', status: 'running' }));
    expect(JSON.stringify(f.events).length).toBeLessThan(4096);
  });

  it('bounds text/queue pressure and isolates rejecting or hanging observation sinks', async () => {
    const f = fixture('codex');
    for (let i = 0; i < 400; i++) f.observer.push(Buffer.from(line({ type: 'item.completed', item: { type: 'agent_message', text: String(i) + 'x'.repeat(4000) } })));
    await f.observer.finish();
    expect(f.events.length).toBeLessThanOrEqual(66); expect(f.events.every(event => !event.text || event.text.length <= 2048)).toBe(true);
    const rejected = providerSessionObserver({ provider: 'codex', capture: async () => { throw new Error('PRIVATE_STORAGE_ERROR'); } });
    rejected.push(Buffer.from(line({ type: 'thread.started', thread_id: 'root-1' }))); await rejected.finish();
    const hung = providerSessionObserver({ provider: 'codex', capture: async () => new Promise<void>(() => {}) });
    hung.push(Buffer.from(line({ type: 'thread.started', thread_id: 'root-1' })));
    const start = Date.now(); await hung.finish(); expect(Date.now() - start).toBeLessThan(1500);
  });
});
