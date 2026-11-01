import { expect, it } from 'vitest';
import { ClaudeSessionResult } from '../../../infrastructure/coforge/claude-stream-result';
import { reportedClaudeCost, reportedClaudeUsage } from '../../../features/coforge/application/claude-protocol';

const init = { type: 'system', subtype: 'init', session_id: 'root' };
const agent = { type: 'assistant', session_id: 'root', message: { content: [{ type: 'tool_use', name: 'Agent', id: 'tool-native' }] } };
const result = { type: 'result', subtype: 'success', session_id: 'root', is_error: false, structured_output: { summary: 'Initial root' }, total_cost_usd: 0.1 };
const resumed = { ...result, structured_output: { summary: 'Root after native task notification' }, total_cost_usd: 0.2 };
const notification = { type: 'system', subtype: 'task_notification', session_id: 'root', tool_use_id: 'tool-native', task_id: 'task-native' };
function project(events: object[], native = true) {
  const projection = new ClaudeSessionResult(undefined, native);
  projection.append(Buffer.from(events.map(event => JSON.stringify(event)).join('\n') + '\n'));
  return JSON.parse(projection.result());
}
it('retains the latest genuine root result after native-task notification and same-root SDK continuation', () => {
  expect(project([init, agent, result, notification, init, resumed, { ...result, parent_tool_use_id: 'tool-native', structured_output: { summary: 'Wrong child' } }])).toEqual(resumed);
  expect(project([init, agent, result, notification, init, resumed], false)).toMatchObject({ is_error: true, subtype: 'error_stream_incomplete' });
});
it('requires a new result after SDK resumes and never accepts an uncorrelated or foreign result', () => {
  for (const events of [[init, agent, result, init], [init, result, init, resumed], [init, agent, result, { ...notification, tool_use_id: 'foreign' }, resumed],
    [init, agent, result, { ...init, session_id: 'foreign' }, resumed]]) {
    expect(project(events)).toMatchObject({ is_error: true, subtype: 'error_stream_incomplete' });
  }
});
it('keeps fatal errors and root failures unsuccessful across native task continuation', () => {
  for (const events of [[init, agent, result, { type: 'error', session_id: 'root', message: 'Fatal SDK error' }, notification, init, resumed],
    [init, agent, { ...result, is_error: true, subtype: 'error_max_turns' }, notification, init, resumed]]) {
    expect(project(events).is_error).toBe(true);
  }
});
it('uses installed-SDK cumulative modelUsage and total cost once, preserving child usage across per-query root counters', () => {
  const first = { ...result, total_cost_usd: 0.00084, usage: { input_tokens: 20, output_tokens: 20 }, modelUsage: { selected: { inputTokens: 70, outputTokens: 70, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
  const last = { ...resumed, total_cost_usd: 0.00096, usage: { input_tokens: 10, output_tokens: 10 }, modelUsage: { selected: { inputTokens: 80, outputTokens: 80, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
  const raw = JSON.stringify(project([init, agent, first, notification, init, last]));
  expect(reportedClaudeCost(raw)).toBe(0.00096);
  expect(reportedClaudeUsage(raw, { delegated: true })).toEqual({ inputTokens: 80, outputTokens: 80, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });
});
it('retains known cumulative spend when native continuation is interrupted, without returning an unverified structured result', () => {
  const first = { ...result, structured_output: { summary: 'UNVERIFIED_PAYLOAD' }, total_cost_usd: 0.00084,
    modelUsage: { selected: { inputTokens: 70, outputTokens: 70, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
  const raw = JSON.stringify(project([init, agent, first, notification, init]));
  expect(JSON.parse(raw)).toMatchObject({ is_error: true, subtype: 'error_stream_incomplete' });
  expect(reportedClaudeCost(raw)).toBe(0.00084);
  expect(reportedClaudeUsage(raw, { delegated: true })).toMatchObject({ inputTokens: 70, outputTokens: 70 });
  expect(raw).not.toContain('UNVERIFIED_PAYLOAD');
  expect(reportedClaudeCost(JSON.stringify(project([init, agent, first, notification, init, resumed], false)))).toBeUndefined();
});
