import { expect, it } from 'vitest';
import { nativeCodingCodexModel, restrictedCodexModel } from '../../../infrastructure/coforge/codex-model-profile';
import { CodexOutput } from '../../../infrastructure/coforge/codex-output';
import { codexResult } from '../../../features/coforge/application/codex-protocol';

it('preserves exactly the selected native model metadata and normal coding tools without changing legacy broker profiles', () => {
  const source = { slug: 'selected', multi_agent_version: 'v2', shell_type: 'shell_command', tool_mode: 'code_mode_only', use_responses_lite: true,
    base_instructions: 'SDK coding instructions', include_skills_usage_instructions: true, experimental_supported_tools: ['native_supported_tool'] };
  const cache = { models: [source, { slug: 'other', multi_agent_version: 'v2' }] };
  expect(nativeCodingCodexModel('selected', cache)).toEqual({ models: [source] });
  expect(restrictedCodexModel('selected', cache)).toMatchObject({ models: [{ tool_mode: 'direct', experimental_supported_tools: [], include_skills_usage_instructions: false }] });
  expect(source.base_instructions).toBe('SDK coding instructions');
  expect(() => nativeCodingCodexModel('missing', cache)).toThrow('not advertised');
});
it('retains authoritative root semantics despite multi-megabyte native command and reasoning records, excluding child finals', () => {
  const projection = new CodexOutput();
  for (const event of [{ type: 'thread.started', thread_id: 'root' },
    { type: 'item.completed', item: { type: 'command_execution', aggregated_output: 'PRIVATE_TOOL_OUTPUT'.repeat(180000) } },
    { type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE_REASONING' } },
    { type: 'item.completed', thread_id: 'foreign', item: { type: 'agent_message', text: '{"summary":"Wrong child"}' } },
    { type: 'item.completed', item: { type: 'agent_message', text: '{"summary":"Genuine root"}' } },
    { type: 'turn.completed', usage: { input_tokens: 12, output_tokens: 3, cached_input_tokens: 0 } }]) projection.append(Buffer.from(JSON.stringify(event) + '\n'));
  const retained = projection.result();
  expect(retained).not.toMatch(/PRIVATE_|Wrong child/u);
  expect(codexResult(retained).output).toEqual({ summary: 'Genuine root' });
  expect(retained.length).toBeLessThan(1000);
});
