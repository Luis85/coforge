import { expect, it } from 'vitest';
import type { AgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import { providerSessionObserver } from '../../../infrastructure/coforge/provider-session-stream';
const stream = (...events: object[]) => Buffer.from(events.map(event => JSON.stringify(event)).join('\n') + '\n');

it('records an actual Codex command exit and bounded sanitized output without retaining its arguments or inventing source coverage', async () => {
  const events: AgentSessionEvent[] = [], observer = providerSessionObserver({ provider: 'codex', capture: async event => { events.push(event); } });
  observer.push(stream({ type: 'thread.started', thread_id: 'root' }, { type: 'item.completed', item: { type: 'command_execution', command: 'PRIVATE_COMMAND_ARGUMENTS', exit_code: 1, status: 'failed', aggregated_output: 'ASSERTION_FAILED Bearer PRIVATE_TOKEN /srv/private/test.js' } }));
  await observer.finish();
  expect(events).toContainEqual(expect.objectContaining({ kind: 'tool', sessionId: 'root', tool: 'native_command', status: 'failed', text: expect.stringContaining('exit code 1') }));
  expect(JSON.stringify(events)).toContain('ASSERTION_FAILED'); expect(JSON.stringify(events)).not.toMatch(/PRIVATE_COMMAND|PRIVATE_TOKEN|\/srv\/private/u);
});

it('correlates the actual Claude Bash result without inferring numeric exit zero from an SDK non-error flag', async () => {
  const events: AgentSessionEvent[] = [], observer = providerSessionObserver({ provider: 'claude', capture: async event => { events.push(event); } });
  observer.push(stream({ type: 'system', subtype: 'init', session_id: 'root' },
    { type: 'assistant', session_id: 'root', message: { content: [{ type: 'tool_use', id: 'command-1', name: 'Bash', input: { command: 'PRIVATE_COMMAND' } }] } },
    { type: 'user', session_id: 'root', message: { content: [{ type: 'tool_result', tool_use_id: 'command-1', is_error: false, content: 'PRIVATE_RAW_TOOL_CONTENT' }] },
      tool_use_result: { stdout: 'NATIVE_ASSERTION_OK', stderr: '', interrupted: false, isImage: false, noOutputExpected: false } }));
  await observer.finish();
  expect(events).toContainEqual(expect.objectContaining({ kind: 'tool', tool: 'Bash', status: 'completed', text: expect.stringContaining('Numeric command exit status is unavailable') }));
  expect(JSON.stringify(events)).toContain('NATIVE_ASSERTION_OK'); expect(JSON.stringify(events)).not.toMatch(/PRIVATE_COMMAND|PRIVATE_RAW_TOOL|exit code 0/u);
});

it('omits nested SDK transport records from native stdout previews, retaining ordinary test output', async () => {
  const events: AgentSessionEvent[] = [], observer = providerSessionObserver({ provider: 'codex', capture: async event => { events.push(event); } });
  observer.push(stream({ type: 'thread.started', thread_id: 'root' }, { type: 'item.completed', item: { type: 'command_execution', exit_code: 0, status: 'completed',
    aggregated_output: 'TEST_OUTPUT_OK\n' + JSON.stringify({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'PRIVATE_NESTED_REASONING' }] } }) } }));
  await observer.finish();
  expect(JSON.stringify(events)).toContain('TEST_OUTPUT_OK'); expect(JSON.stringify(events)).not.toContain('PRIVATE_NESTED_REASONING');
});
it('does not turn asynchronous native Agent acceptance into child completion before actual task metadata', async () => {
  const events: AgentSessionEvent[] = [], observer = providerSessionObserver({ provider: 'claude', capture: async event => { events.push(event); } });
  observer.push(stream({ type: 'system', subtype: 'init', session_id: 'root' },
    { type: 'assistant', session_id: 'root', message: { content: [{ type: 'tool_use', id: 'agent-1', name: 'Agent' }] } },
    { type: 'system', subtype: 'task_started', session_id: 'root', tool_use_id: 'agent-1', task_id: 'task-1' },
    { type: 'user', session_id: 'root', message: { content: [{ type: 'tool_result', tool_use_id: 'agent-1', is_error: false, content: 'The native task was accepted.' }] } }));
  await observer.finish();
  expect(events.filter(event => event.kind === 'session' && event.parentSessionId === 'root').map(event => event.status)).toEqual(['queued', 'running']);
  const completed: AgentSessionEvent[] = [], terminal = providerSessionObserver({ provider: 'claude', capture: async event => { completed.push(event); } });
  terminal.push(stream({ type: 'system', subtype: 'init', session_id: 'root' },
    { type: 'system', subtype: 'task_notification', session_id: 'root', tool_use_id: 'agent-1', task_id: 'task-1', status: 'completed' }));
  await terminal.finish();
  expect(completed).toContainEqual(expect.objectContaining({ kind: 'session', sessionId: 'claude-tool:agent-1', status: 'completed' }));
});
it('still records a genuinely failed native Agent request as failed', async () => {
  const events: AgentSessionEvent[] = [], observer = providerSessionObserver({ provider: 'claude', capture: async event => { events.push(event); } });
  observer.push(stream({ type: 'system', subtype: 'init', session_id: 'root' },
    { type: 'assistant', session_id: 'root', message: { content: [{ type: 'tool_use', id: 'agent-1', name: 'Agent' }] } },
    { type: 'user', session_id: 'root', message: { content: [{ type: 'tool_result', tool_use_id: 'agent-1', is_error: true, content: 'PRIVATE_FAILURE_DETAILS' }] } }));
  await observer.finish();
  expect(events).toContainEqual(expect.objectContaining({ kind: 'session', sessionId: 'claude-tool:agent-1', status: 'failed' }));
  expect(JSON.stringify(events)).not.toContain('PRIVATE_FAILURE_DETAILS');
});
