import { expect, it, vi } from 'vitest';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { ProcessOptions } from '../../../infrastructure/coforge/process';
import { ProcessFailure } from '../../../infrastructure/coforge/process';
import { captureObservedClaude } from '../../../infrastructure/coforge/claude-observed-capture';

const result = { type: 'result', subtype: 'success', is_error: false, session_id: 'root-1', structured_output: { summary: 'Root final' }, total_cost_usd: 0.1 };
const stream = (...events: object[]) => events.map(event => JSON.stringify(event)).join('\n') + '\n';
const input = (onSessionEvent?: StageInput['onSessionEvent']) => ({ onSessionEvent });
it('keeps legacy capture unchanged without session observation', async () => {
  const capture = vi.fn(async () => 'EXISTING_RAW'); const options = { cwd: '/private' };
  expect(await captureObservedClaude(input(), 'claude', ['--output-format', 'json'], options, capture)).toBe('EXISTING_RAW');
  expect(capture).toHaveBeenCalledWith('claude', ['--output-format', 'json'], options);
});
it('streams observations but returns only the genuine root result to existing interpretation', async () => {
  const observed: object[] = []; const capture = vi.fn(async (_command: string, args: readonly string[], options: ProcessOptions) => {
    expect(args).toContain('stream-json'); expect(args).toContain('--verbose');
    const raw = stream({ type: 'system', subtype: 'init', session_id: 'root-1', tools: ['PRIVATE_CONFIGURATION'] },
      { type: 'assistant', session_id: 'root-1', message: { content: [{ type: 'text', text: 'Working' }] } }, result,
      { ...result, session_id: 'child-1', parent_tool_use_id: 'toolu_child', structured_output: { summary: 'WRONG_CHILD_RESULT' } });
    await options.onStdout?.(Buffer.from(raw)); return raw;
  });
  const raw = await captureObservedClaude(input(async event => { observed.push(event); }), 'claude', ['--output-format', 'json'], { cwd: '/private' }, capture);
  expect(JSON.parse(raw)).toEqual(result); expect(observed.some(event => JSON.stringify(event).includes('Working'))).toBe(true);
  expect(JSON.stringify(observed)).not.toContain('PRIVATE_CONFIGURATION');
});
it('never returns a raw stream containing reasoning/args when a failed invocation has no root final', async () => {
  const raw = stream({ type: 'system', subtype: 'init', session_id: 'root-1' }, { type: 'assistant', message: { content: [{ type: 'thinking', thinking: 'PRIVATE_REASONING' }] } });
  const capture = async () => { throw new ProcessFailure('Stopped', raw); };
  try { await captureObservedClaude(input(async () => {}), 'claude', ['--output-format', 'json'], { cwd: '/private' }, capture); }
  catch (error) { expect(error).toBeInstanceOf(ProcessFailure); expect(JSON.stringify(error)).not.toContain('PRIVATE_REASONING'); expect(error instanceof ProcessFailure && JSON.parse(error.output)).toMatchObject({ is_error: true, subtype: 'error_stream_incomplete' }); return; }
  throw new Error('Failed capture unexpectedly succeeded');
});
it('keeps conflicting root results or a fatal error after completion unsuccessful', async () => {
  for (const events of [[result, { ...result, is_error: true }], [result, { type: 'error', message: 'fatal' }]]) {
    const raw = await captureObservedClaude(input(async () => {}), 'claude', ['--output-format', 'json'], { cwd: '/private' }, async () => stream({ type: 'system', subtype: 'init', session_id: 'root-1' }, ...events));
    expect(JSON.parse(raw)).toMatchObject({ is_error: true, subtype: 'error_stream_incomplete' });
  }
});
it('drops terminal transcript extras and denied tool arguments while preserving output/cost/usage semantics', async () => {
  const raw = await captureObservedClaude(input(async () => {}), 'claude', ['--output-format', 'json'], { cwd: '/private' }, async () => JSON.stringify({ ...result,
    permission_denials: [{ tool_input: { prompt: 'PRIVATE_TOOL_ARGS' } }], thinking: 'PRIVATE_THINKING', system_prompt: 'PRIVATE_GLOBAL_PROMPT',
    usage: { input_tokens: 12, output_tokens: 3, hidden_payload: 'PRIVATE_USAGE_DATA' }, modelUsage: { selected: { inputTokens: 12, outputTokens: 3, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, tool_input: 'PRIVATE_MODEL_ARGS' } } }));
  expect(JSON.parse(raw)).toMatchObject({ ...result, usage: { input_tokens: 12, output_tokens: 3 }, modelUsage: { selected: { inputTokens: 12, outputTokens: 3, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } });
  expect(raw).not.toContain('PRIVATE_');
});
it('preserves a valid execution result when session persistence rejects', async () => {
  const raw = await captureObservedClaude(input(async () => { throw new Error('Display storage unavailable'); }), 'claude', ['--output-format', 'json'], { cwd: '/private' },
    async (_command, _args, options) => { const value = JSON.stringify(result); await options.onStdout?.(Buffer.from(value)); return value; });
  expect(JSON.parse(raw)).toEqual(result);
});
it('discloses display truncation while preserving the full authoritative structured result', async () => {
  const summary = 'Long assistant result '.repeat(150), events: object[] = [];
  const raw = await captureObservedClaude(input(async event => { events.push(event); }), 'claude', ['--output-format', 'json'], { cwd: '/private' }, async (_command, _args, options) => {
    const value = stream({ type: 'assistant', session_id: 'root-1', message: { content: [{ type: 'text', text: summary }] } }, { ...result, structured_output: { summary } });
    await options.onStdout?.(Buffer.from(value)); return value;
  });
  expect(JSON.parse(raw).structured_output.summary).toBe(summary); expect(events.some(event => JSON.stringify(event).includes('truncated'))).toBe(true);
});
