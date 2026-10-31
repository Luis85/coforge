import { expect, it } from 'vitest';
import { buildCodexArgs, codexResult, codexUsage } from '../../../features/coforge/application/codex-protocol';
import { restrictedCodexModel } from '../../../infrastructure/coforge/codex-model-profile';
import { codexOutputSchema, normalizeCodexOutput } from '../../../features/coforge/application/codex-schema';

it('constructs a read-only ephemeral launch with only explicit MCP and no shell wrapper', () => {
  const args = buildCodexArgs({ model: 'gpt-6.1-sol', effort: 'xhigh', schemaPath: '/private/schema.json', modelProfilePath: '/private/profile.json', mcpUrl: 'http://127.0.0.1:1234/mcp' });
  expect(args).toContain('--ignore-user-config'); expect(args).toContain('--ignore-rules'); expect(args).toContain('--strict-config');
  expect(args).toContain('--ephemeral'); expect(args).toContain('read-only');
  expect(args).toContain('features.shell_tool=false'); expect(args).toContain('features.multi_agent=false');
  expect(args).toContain('model_reasoning_effort="xhigh"');
  expect(args).toContain('model_catalog_json="/private/profile.json"');
  expect(args.find(value => value.startsWith('mcp_servers='))).toContain('bearer_token_env_var');
  expect(args.find(value => value.startsWith('mcp_servers='))).toContain('"default_tools_approval_mode" = "approve"');
  expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
});
it('constrains model capabilities without changing identity or copying account identity', () => {
  const result = restrictedCodexModel('gpt-6.1-sol', { identity: 'private-account', models: [{ slug: 'gpt-6.1-sol', input_modalities: ['text', 'image'], apply_patch_tool_type: 'freeform', experimental_supported_tools: ['shell'], model_messages: { private: 'instructions' } }] });
  expect(result).toMatchObject({ models: [{ slug: 'gpt-6.1-sol', input_modalities: ['text'], apply_patch_tool_type: null, experimental_supported_tools: [], supports_parallel_tool_calls: false, multi_agent_version: null, tool_mode: 'direct', use_responses_lite: false }] });
  expect(JSON.stringify(result)).not.toContain('private-account'); expect(JSON.stringify(result)).not.toContain('model_messages');
  expect(() => restrictedCodexModel('unknown', { models: [] })).toThrow('local Codex catalogue');
});
it('interprets the final structured response and subtracts cached input once', () => {
  const raw = [ { type: 'item.completed', item: { type: 'agent_message', text: '{"markdown":"# Advice"}' } }, { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 15 } } ].map(item => JSON.stringify(item)).join('\n');
  expect(codexResult(raw)).toEqual({ output: { markdown: '# Advice' }, usage: { inputTokens: 20, cacheReadInputTokens: 80, outputTokens: 15 } });
  expect(codexUsage(raw)).not.toHaveProperty('cacheCreationInputTokens');
  expect(() => codexResult(raw.replace('turn.completed', 'turn.failed'))).toThrow('did not complete');
  expect(codexUsage(raw.replace('"cached_input_tokens":80', '"cached_input_tokens":101'))).toBeUndefined();
});

it('preserves optional replies while adapting the output contract to strict JSON Schema', () => {
  const schema = { type: 'object', properties: { markdown: { type: 'string' }, messageDrafts: { type: 'array', items: { type: 'object', properties: { purpose: { enum: ['information', 'reply'] }, replyTo: { type: 'string' } }, required: ['purpose'] } } }, required: ['markdown'] };
  const converted = codexOutputSchema(schema);
  expect(converted).toMatchObject({ required: ['markdown', 'messageDrafts'], properties: { messageDrafts: { anyOf: [{ items: { required: ['purpose', 'replyTo'], properties: { purpose: { type: 'string' }, replyTo: { anyOf: [{ type: 'string' }, { type: 'null' }] } } } }, { type: 'null' }] } } });
  expect(normalizeCodexOutput({ markdown: 'Advice', messageDrafts: null }, schema)).toEqual({ markdown: 'Advice' });
  expect(normalizeCodexOutput({ markdown: 'Advice', messageDrafts: [{ purpose: 'information', replyTo: null }, { purpose: 'reply', replyTo: 'message-1' }] }, schema)).toEqual({ markdown: 'Advice', messageDrafts: [{ purpose: 'information' }, { purpose: 'reply', replyTo: 'message-1' }] });
  expect(normalizeCodexOutput({ markdown: null, unknown: 'keep for validation' }, schema)).toEqual({ markdown: null, unknown: 'keep for validation' });
  expect(normalizeCodexOutput({ markdown: 'Advice', constructor: null }, schema)).toEqual({ markdown: 'Advice', constructor: null });
});
