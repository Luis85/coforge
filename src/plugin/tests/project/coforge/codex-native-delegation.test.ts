import { expect, it } from 'vitest';
import { buildCodexArgs, codexResult, codexUsage } from '../../../features/coforge/application/codex-protocol';
import { restrictedCodexModel } from '../../../infrastructure/coforge/codex-model-profile';
import { captureCodexResponse } from '../../../infrastructure/coforge/codex-conversation';
import { ProviderOutput } from '../../../infrastructure/coforge/durable-worker/output';

const invocation = { model: 'gpt-6.1-sol', schemaPath: '/private/schema.json', modelProfilePath: '/private/model.json', mcpUrl: 'http://127.0.0.1:1234/mcp' };
const nativeTools = { delegation: { maxConcurrent: 2 } };
const stream = (...events: object[]) => events.map(event => JSON.stringify(event)).join('\n');
const usage = { input_tokens: 100, cached_input_tokens: 20, output_tokens: 30 };
const rootMessage = { type: 'item.completed', item: { type: 'agent_message', text: '{"summary":"Root result"}' } };
const childMessage = { type: 'item.completed', agent: { agent_name: '/root/reviewer' }, item: { type: 'agent_message', text: '{"summary":"Child must not replace root"}' } };

it('enables only provider-native v2 delegation with finite concurrency and inherited restricted tools', () => {
  const args = buildCodexArgs({ ...invocation, nativeTools });
  expect(args).toContain('features.multi_agent_v2={ "enabled" = true, "max_concurrent_threads_per_session" = 3, "expose_spawn_agent_model_overrides" = false }');
  expect(args).toContain('features.multi_agent=false');
  expect(args.join(' ')).not.toContain('cli_auth_credentials_store'); expect(args.join(' ')).not.toContain('secret_auth_storage');
  for (const disabled of ['shell_tool', 'unified_exec', 'browser_use', 'apps', 'plugins', 'hooks', 'code_mode', 'code_mode_host']) expect(args).toContain(`features.${disabled}=false`);
  expect(args).toContain('--ignore-user-config'); expect(args).toContain('--ignore-rules'); expect(args).not.toContain('--ephemeral'); expect(args).toContain('read-only');
  expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
  expect(buildCodexArgs(invocation)).toContain('features.multi_agent_v2=false');
  expect(buildCodexArgs(invocation)).toContain('--ephemeral');
  expect(buildCodexArgs({ ...invocation, nativeTools: { verification: { commandIds: ['tests'] } } })).toContain('--ephemeral');
  expect(buildCodexArgs({ ...invocation, nativeTools: { delegation: { maxConcurrent: 1 } } })).toContain('features.multi_agent_v2={ "enabled" = true, "max_concurrent_threads_per_session" = 2, "expose_spawn_agent_model_overrides" = false }');
  expect(() => buildCodexArgs({ ...invocation, nativeTools: { delegation: { maxConcurrent: 0 } } })).toThrow();
  expect(() => buildCodexArgs({ ...invocation, nativeTools: { delegation: { maxConcurrent: 9 } } })).toThrow();
});

it('uses only supported selected-model delegation metadata and retains the existing private capability restriction', () => {
  const metadata = { models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v2', base_instructions: 'untrusted original', model_messages: { secret: 'not copied' }, experimental_supported_tools: ['shell'] }] };
  const result = restrictedCodexModel('gpt-6.1-sol', metadata, nativeTools);
  expect(result).toMatchObject({ models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v2', experimental_supported_tools: [], apply_patch_tool_type: null, node_repl_disabled: true, tool_mode: 'direct' }] });
  expect(JSON.stringify(result)).toContain('provider-native subagents');
  expect(JSON.stringify(result)).not.toContain('untrusted original'); expect(JSON.stringify(result)).not.toContain('not copied');
  expect(restrictedCodexModel('gpt-6.1-sol', metadata)).toMatchObject({ models: [{ multi_agent_version: null }] });
  expect(() => restrictedCodexModel('gpt-6.1-sol', { models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v1' }] }, nativeTools)).toThrow('v2');
  expect(() => restrictedCodexModel('gpt-6.1-sol', { models: [{ slug: 'gpt-6.1-sol' }] }, nativeTools)).toThrow('v2');
});

it('passes only a finite captured MCP tool timeout while leaving the outer invocation deadline independent', () => {
  const args = buildCodexArgs({ ...invocation, mcpToolTimeoutSeconds: 59600 });
  expect(args.find(value => value.startsWith('mcp_servers='))).toContain('"tool_timeout_sec" = 59600');
  expect(buildCodexArgs(invocation).find(value => value.startsWith('mcp_servers='))).not.toContain('tool_timeout_sec');
  expect(() => buildCodexArgs({ ...invocation, mcpToolTimeoutSeconds: Infinity })).toThrow();
});

it('takes the root exec result rather than a later native child result or child failure', () => {
  const raw = stream({ type: 'thread.started', thread_id: 'primary' }, rootMessage,
    { type: 'turn.completed', usage }, childMessage, { type: 'turn.failed', agent: { agent_name: '/root/reviewer' }, thread_id: 'child' });
  expect(codexResult(raw, { delegated: true })).toEqual({ output: { summary: 'Root result' }, usage: undefined });
  // Provider-reported root usage does not establish complete native-tree usage.
  expect(codexUsage(raw, { delegated: true })).toBeUndefined();
  expect(codexUsage(raw)).toEqual({ inputTokens: 80, outputTokens: 30, cacheReadInputTokens: 20 });
});

it('rejects child-only completion, foreign thread events and root failure without laundering a child output', () => {
  const start = { type: 'thread.started', thread_id: 'primary' };
  expect(() => codexResult(stream(start, childMessage, { type: 'turn.completed', agent: { agent_name: '/root/reviewer' }, usage }), { delegated: true })).toThrow('did not complete');
  for (const foreign of [{ ...rootMessage, thread_id: 'foreign' }, { ...rootMessage, thread_id: 'primary', item: { ...rootMessage.item, thread_id: 'foreign' } }]) {
    let failure: unknown;
    try { codexResult(stream(start, foreign, { type: 'turn.completed', usage }), { delegated: true }); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ failure: { code: 'incomplete_output' } });
  }
  expect(() => codexResult(stream(start, rootMessage, { type: 'turn.failed' }, childMessage, { type: 'turn.completed', thread_id: 'child', usage }), { delegated: true })).toThrow('did not complete');
  expect(() => codexResult(stream(rootMessage, { type: 'turn.completed', usage }), { delegated: true })).toThrow('root identity');
});

it('never drops a root failure from the bounded projection when a later event reports completion', () => {
  const output = new ProviderOutput(true);
  output.append(Buffer.from(stream({ type: 'thread.started', thread_id: 'primary' }, rootMessage, { type: 'turn.failed' }, { type: 'turn.completed', usage }) + '\n'));
  expect(() => codexResult(output.result(), { delegated: true })).toThrow('did not complete');
});

it('filters child prose from private conversation evidence without implementing child orchestration', async () => {
  const events: string[] = [];
  await captureCodexResponse(async event => { if (event.kind === 'response') events.push(event.text); }, stream({ type: 'thread.started', thread_id: 'primary' }, rootMessage, childMessage,
    { type: 'item.completed', thread_id: 'foreign', item: { type: 'agent_message', text: 'Foreign prose' } }), {});
  expect(events).toEqual(['{"summary":"Root result"}']);
});

it('retains root identity and root final semantics in the bounded durable stream projection', () => {
  const output = new ProviderOutput(true);
  const raw = stream({ type: 'thread.started', thread_id: 'primary' }, rootMessage, { type: 'turn.completed', usage }, childMessage, { type: 'turn.failed', agent: { agent_name: '/root/reviewer' } }) + '\n';
  for (let start = 0; start < raw.length; start += 17) output.append(Buffer.from(raw.slice(start, start + 17)));
  expect(output.result()).toContain('thread.started'); expect(output.result()).not.toContain('Child must not replace root');
  expect(codexResult(output.result(), { delegated: true })).toMatchObject({ output: { summary: 'Root result' } });
});
