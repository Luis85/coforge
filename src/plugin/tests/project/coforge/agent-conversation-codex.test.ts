import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../../infrastructure/coforge/codex-model-profile', () => ({ writeCodexModelProfile: async () => '/synthetic/private-model-profile.json' }));
import { runCodexTransport, type CodexTransportInput } from '../../../infrastructure/coforge/codex-transport';
import { ProcessFailure, type ProcessOptions } from '../../../infrastructure/coforge/process';
import type { AgentConversationEvent } from '../../../features/coforge/domain/agent-conversation';

const folders: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true });
});
const message = (text: string) => ({ type: 'item.completed', item: { type: 'agent_message', text } });
const completed = { type: 'turn.completed', usage: { input_tokens: 40, cached_input_tokens: 10, output_tokens: 8 } };
const stream = (...events: object[]) => events.map(event => JSON.stringify(event)).join('\n');

async function fixture(raw = stream(message('{"markdown":"# Captured answer"}'), completed)) {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-conversation-codex-'));
  folders.push(directory);
  const events: AgentConversationEvent[] = [];
  const capture = vi.fn(async (_executable: string, _args: readonly string[], _options: ProcessOptions) => raw);
  const telemetry = vi.fn(async () => {});
  const input: CodexTransportInput = {
    directory, executable: 'synthetic-codex', model: 'gpt-6.1-sol', effort: 'high',
    schema: { type: 'object', properties: { markdown: { type: 'string' } }, required: ['markdown'], additionalProperties: false },
    instructions: 'Captured system instructions', prompt: 'The captured task', timeoutMs: 30000,
    capture, telemetry, onConversation: async event => { events.push(event); },
  };
  return { input, capture, telemetry, events };
}

it('captures the exact guarded Codex input before dispatch and the original message before normalization', async () => {
  const f = await fixture();
  f.capture.mockImplementation(async (_executable, _args, options) => {
    expect(f.events).toHaveLength(1);
    const request = f.events[0];
    if (request?.kind !== 'request') throw new Error('Missing saved provider request.');
    expect(request.instructions).toContain('Captured system instructions');
    expect(request.instructions).toContain('Use only the scoped CoForge MCP tools.');
    expect(request.prompt).toBe('The captured task');
    expect(options.input).toBe(`${request.instructions}\n\n${request.prompt}`);
    expect(request.simulated).not.toBe(true);
    return stream(message('{"markdown":"# Captured answer"}'), completed);
  });
  expect(await runCodexTransport(f.input)).toMatchObject({ output: { markdown: '# Captured answer' } });
  expect(f.events[1]).toEqual({ kind: 'response', text: '{"markdown":"# Captured answer"}' });
  expect(f.telemetry).toHaveBeenCalledWith({ inputTokens: 30, cacheReadInputTokens: 10, outputTokens: 8 });
});

it('retains malformed final text before rejecting structured JSON', async () => {
  const f = await fixture(stream(message('The provider returned text instead of JSON.'), completed));
  await expect(runCodexTransport(f.input)).rejects.toThrow('invalid structured output');
  expect(f.events[1]).toEqual({ kind: 'response', text: 'The provider returned text instead of JSON.' });
  expect(f.telemetry).toHaveBeenCalledWith({ inputTokens: 30, cacheReadInputTokens: 10, outputTokens: 8 });
});

it('retains available assistant text from a failed process without exposing tool, reasoning or envelope data', async () => {
  const raw = stream(
    { type: 'thread.started', thread_id: 'PRIVATE_THREAD_ID' },
    { type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE_INTERNAL_REASONING' } },
    { type: 'item.completed', item: { type: 'mcp_tool_call', result: 'PRIVATE_TOOL_RESULT' } },
    message('Partial answer before failure.'), completed,
  );
  const f = await fixture();
  f.capture.mockRejectedValue(new ProcessFailure('Process exited with code 1.', raw));
  await expect(runCodexTransport(f.input)).rejects.toThrow('Codex did not complete');
  expect(f.events[1]).toEqual({ kind: 'response', text: 'Partial answer before failure.' });
  expect(JSON.stringify(f.events)).not.toContain('PRIVATE_');
  expect(f.telemetry).toHaveBeenCalledWith({ inputTokens: 30, cacheReadInputTokens: 10, outputTokens: 8 });
});

it('redacts known credentials and the temporary scoped-tool token from retained assistant text', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'private-openai-key-12345');
  const f = await fixture(stream(message('{"markdown":"private-openai-key-12345 temporary-mcp-secret-12345"}'), completed));
  f.input.mcp = { url: 'http://127.0.0.1:1234/mcp', token: 'temporary-mcp-secret-12345' };
  await runCodexTransport(f.input);
  const response = f.events[1];
  if (response?.kind !== 'response') throw new Error('Missing captured answer.');
  expect(response.text).toContain('[redacted]');
  expect(response.text).not.toContain('private-openai-key-12345');
  expect(response.text).not.toContain('temporary-mcp-secret-12345');
});

it('does not dispatch when saving captured input fails', async () => {
  const f = await fixture();
  f.input.onConversation = async () => { throw new Error('Conversation write failed'); };
  await expect(runCodexTransport(f.input)).rejects.toThrow('Conversation write failed');
  expect(f.capture).not.toHaveBeenCalled();
});

it('preserves token telemetry and rejects completion when saving returned evidence fails', async () => {
  const f = await fixture();
  f.input.onConversation = async event => { if (event.kind === 'response') throw new Error('Response write failed'); };
  await expect(runCodexTransport(f.input)).rejects.toThrow('Response write failed');
  expect(f.telemetry).toHaveBeenCalledWith({ inputTokens: 30, cacheReadInputTokens: 10, outputTokens: 8 });
  expect(f.capture).toHaveBeenCalledOnce();
});

it('records each user-visible assistant message without treating intermediate tool turns as chat', async () => {
  const f = await fixture(stream(message('A visible progress message.'),
    { type: 'item.completed', item: { type: 'reasoning', text: 'PRIVATE_INTERNAL_REASONING' } },
    message('{"markdown":"# Final answer"}'), completed));
  await expect(runCodexTransport(f.input)).resolves.toMatchObject({ output: { markdown: '# Final answer' } });
  const response = f.events[1];
  if (response?.kind !== 'response') throw new Error('Missing captured messages.');
  expect(response.text).toContain('A visible progress message.');
  expect(response.text).toContain('Final answer');
  expect(response.text).not.toContain('PRIVATE_INTERNAL_REASONING');
});
