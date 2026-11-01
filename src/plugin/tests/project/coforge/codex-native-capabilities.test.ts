import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProcessOptions } from '../../../infrastructure/coforge/process';
const fake = vi.hoisted(() => ({ capture: vi.fn(), model: vi.fn(async () => '/private/model.json') }));
vi.mock('../../../infrastructure/coforge/process', async original => ({ ...(await original<typeof import('../../../infrastructure/coforge/process')>()), captureProcess: fake.capture }));
vi.mock('../../../infrastructure/coforge/codex-model-profile', () => ({ writeCodexModelProfile: fake.model }));
import { runCodexTransport } from '../../../infrastructure/coforge/codex-transport';
import { createCodexPrivateRuntime } from '../../../infrastructure/coforge/codex-private-runtime';

const directories: string[] = [];
afterEach(async () => { fake.capture.mockReset(); fake.model.mockClear(); vi.unstubAllEnvs(); for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function fixture(problem?: 'old' | 'feature' | 'flags' | 'model' | 'context') {
  const allocated = await mkdtemp(join(tmpdir(), 'coforge-codex-'));
  const privateRuntime = await createCodexPrivateRuntime(allocated, { runId: 'run', attemptId: 'attempt', projectId: 'CFP-001' });
  const directory = privateRuntime.directory; directories.push(directory);
  const source = join(directory, 'auth-source'); await mkdir(source); await writeFile(join(source, 'auth.json'), 'OPAQUE_FAKE_AUTH');
  vi.stubEnv('CODEX_HOME', source); vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('CODEX_API_KEY', '');
  const calls: Array<{ args: readonly string[]; options: ProcessOptions }> = [];
  fake.capture.mockImplementation(async (_executable: string, args: readonly string[], options: ProcessOptions) => {
    calls.push({ args, options });
    if (args.includes('--version')) return problem === 'old' ? 'codex-cli 0.144.0' : 'codex-cli 0.145.0';
    if (args.includes('--help')) return problem === 'flags' ? '--json --output-schema' : '--strict-config --ignore-user-config --ignore-rules --ephemeral --sandbox --json --output-schema';
    if (args[0] === 'features') return problem === 'feature' ? 'multi_agent_v2 stable false' : 'multi_agent_v2 stable true';
    if (args[0] === 'debug' && args[1] === 'models') return JSON.stringify({ models: [{ slug: problem === 'model' ? 'other-model' : 'gpt-6.1-sol', multi_agent_version: 'v2' }] });
    if (args[0] === 'debug') return JSON.stringify([{ role: 'developer', content: `There are ${problem === 'context' ? 2 : 3} available concurrency slots, meaning that up to ${problem === 'context' ? 2 : 3} agents can be active at once, including you.` }]);
    return [{ type: 'thread.started', thread_id: 'primary' }, { type: 'item.completed', item: { type: 'agent_message', text: '{"summary":"Native root"}' } }, { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 0, output_tokens: 5 } }].map(event => JSON.stringify(event)).join('\n');
  });
  return { directory, calls, request: { directory, executable: 'synthetic-codex', model: 'gpt-6.1-sol', schema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
    instructions: 'Implement', prompt: 'Request', timeoutMs: 10000, nativeTools: { delegation: { maxConcurrent: 2 } }, privateRuntime } };
}

it('validates installed native flags and bounded v2 feature configuration locally before starting inference', async () => {
  const f = await fixture();
  const result = await runCodexTransport(f.request);
  expect(f.calls.slice(0, 3).map(call => call.args[0])).toEqual(['--version', 'exec', 'features']);
  for (const probe of f.calls.slice(0, 3)) {
    expect(probe.options.cwd).toBe(f.directory);
    expect(probe.options.env?.CODEX_HOME).toBe(f.directory);
    expect(probe.options.env?.COFORGE_CODEX_MCP_TOKEN).toBeUndefined();
    expect(probe.options.env?.OPENAI_API_KEY).toBeUndefined();
  }
  expect(f.calls[2]!.args.join(' ')).toContain('max_concurrent_threads_per_session');
  expect(f.calls[3]!.args.slice(0, 2)).toEqual(['debug', 'models']);
  expect(f.calls[3]!.options.env?.CODEX_HOME).toBe(join(f.directory, 'codex-home'));
  expect(f.calls[3]!.options.env?.COFORGE_CODEX_MCP_TOKEN).toBeUndefined();
  expect(f.calls[4]!.args.slice(0, 2)).toEqual(['debug', 'prompt-input']);
  const invocation = f.calls[5]!;
  expect(invocation.options.env?.CODEX_HOME).toBe(join(f.directory, 'codex-home'));
  expect(invocation.options.ownedTree).toBe(true);
  expect(invocation.args).toContain('--ignore-user-config');
  expect(invocation.options.input).toContain('provider-native subagents');
  expect(invocation.options.input).toContain('same scoped CoForge tools');
  expect(invocation.options.input).toContain('Native project files, shell, browser and other MCP servers are unavailable');
  expect(result).toEqual({ output: { summary: 'Native root' }, usage: undefined });
  expect(fake.model).toHaveBeenCalledWith(f.directory, 'gpt-6.1-sol', f.request.nativeTools, { models: [{ slug: 'gpt-6.1-sol', multi_agent_version: 'v2' }] });
});

it('rejects native context that does not reserve exactly one coordinator slot beyond the requested assistant bound', async () => {
  const f = await fixture('context');
  await expect(runCodexTransport(f.request)).rejects.toThrow('concurrency boundary');
  expect(f.calls.filter(call => call.args[0] === 'exec' && !call.args.includes('--help'))).toHaveLength(0);
});

it('rejects a cached model not advertised by the isolated native catalogue before any inference', async () => {
  const f = await fixture('model');
  await expect(runCodexTransport(f.request)).rejects.toThrow('not advertised');
  expect(fake.model).not.toHaveBeenCalled();
  expect(f.calls.filter(call => call.args[0] === 'exec' && !call.args.includes('--help'))).toHaveLength(0);
});

it.each(['old', 'feature', 'flags'] as const)('fails closed before inference when native capability check reports %s', async problem => {
  const f = await fixture(problem);
  await expect(runCodexTransport(f.request)).rejects.toThrow('native delegation');
  expect(f.calls.filter(call => call.args[0] === 'exec' && !call.args.includes('--help'))).toHaveLength(0);
});

it('does not enable delegation or probe extra capabilities for existing absent policies', async () => {
  const f = await fixture();
  await runCodexTransport({ ...f.request, nativeTools: undefined });
  expect(f.calls).toHaveLength(1);
  expect(f.calls[0]!.args).toContain('features.multi_agent_v2=false');
  expect(f.calls[0]!.options.input).toContain('delegation are unavailable');
});

it('rejects unbounded native invocation deadlines before probing or inference', async () => {
  const f = await fixture();
  await expect(runCodexTransport({ ...f.request, timeoutMs: Infinity })).rejects.toThrow('finite invocation deadline');
  expect(f.calls).toHaveLength(0);
});
