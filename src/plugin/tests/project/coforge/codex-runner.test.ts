import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../../../infrastructure/coforge/process', async importOriginal => ({ ...(await importOriginal<typeof import('../../../infrastructure/coforge/process')>()), captureProcess: transport.run }));
vi.mock('../../../infrastructure/coforge/codex-model-profile', () => ({ writeCodexModelProfile: async () => '/synthetic/private-model-profile.json' }));
import { runCodexStage } from '../../../infrastructure/coforge/codex-runner';
import { codexWorkflowTools } from '../../../infrastructure/coforge/codex-workflow-tools';
import { codexEnvironment } from '../../../infrastructure/coforge/codex-transport';
import { childEnvironment } from '../../../infrastructure/coforge/process';
import { runCouncilProvider } from '../../../infrastructure/coforge/council-provider';
import { InvocationGate } from '../../../features/coforge/application/invocation-gate';
import { defaultIntegration, defaultSettings, createSeed } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../../features/coforge/application/workflow-workspace-ports';
import type { ProcessOptions } from '../../../infrastructure/coforge/process';
const folders: string[] = [];
afterEach(async () => { transport.run.mockReset(); for (const path of folders.splice(0)) await rm(path, { recursive: true, force: true }); });
const envelope = (output: object) => [ { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(output) } }, { type: 'turn.completed', usage: { input_tokens: 40, cached_input_tokens: 10, output_tokens: 8 } } ].map(item => JSON.stringify(item)).join('\n');

it('forwards Codex credentials only to the Codex child environment', () => {
  const source = { PATH: '/tools', OPENAI_API_KEY: 'private-key', CODEX_HOME: '/custom-codex', UNRELATED_SECRET: 'hidden' };
  expect(codexEnvironment(source)).toEqual({ PATH: '/tools', OPENAI_API_KEY: 'private-key', CODEX_HOME: '/custom-codex' });
  expect(childEnvironment(source)).toEqual({ PATH: '/tools' });
});

it('runs Codex Build from a private directory while host tools guard files and capture actual changes', async () => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'coforge-codex-test-'))); folders.push(cwd);
  await writeFile(join(cwd, 'game.ts'), 'before');
  const captured = vi.fn(async () => ({ summary: 'Host capture', files: [{ path: 'game.ts', additions: 1, deletions: 1 }], diff: '-before\n+after', tests: [], createdAt: new Date().toISOString(), simulated: false }));
  const lease: WorkflowWorkspaceLease = { cwd, id: 'workspace', capture: captured, release: vi.fn(async () => {}), validate: async () => {} };
  const onChanges = vi.fn(); const onTokenUsage = vi.fn();
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: { ...defaultSettings(), provider: 'codex', model: 'gpt-6.1-sol' }, integration: { ...defaultIntegration(), codexBin: 'synthetic-codex' }, onChanges, onTokenUsage,
    workflow: { runId: 'run', definitionRevision: 'definition', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [], step: { id: 'build', name: 'Build', kind: 'ai', provider: 'codex', model: 'gpt-6.1-sol', effort: 'high', instructions: 'Implement', output: 'codechange', access: 'editworktree', automatic: false } } };
  transport.run.mockImplementation(async (_command: string, args: string[], options: ProcessOptions) => {
    expect(options.cwd).not.toBe(cwd); expect(args).not.toContain(cwd);
    expect(args).toContain('model_reasoning_effort="high"');
    const config = args.find(value => value.startsWith('mcp_servers='))!;
    const url = /"url" = "([^"]+)"/u.exec(config)?.[1];
    if (!url) throw new Error('Missing scoped endpoint');
    const call = async (name: string, params: object) => (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${options.env?.COFORGE_CODEX_MCP_TOKEN}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: params } }) })).json();
    expect(await call('coforge_write_file', { path: '.codex/config.toml', content: 'bad', expectedContent: null })).toMatchObject({ result: { isError: true } });
    expect(await call('coforge_write_file', { path: 'package.json', content: 'bad', expectedContent: null })).toMatchObject({ result: { isError: true } });
    await call('coforge_write_file', { path: 'game.ts', content: 'after', expectedContent: 'before' });
    expect(await readFile(join(cwd, 'game.ts'), 'utf8')).toBe('after');
    return envelope({ summary: 'Updated game' });
  });
  const result = await runCodexStage(input, { acquire: async () => lease, assertReviewable: async () => {}, start: async () => {}, acknowledge: async () => {} });
  expect(result.increment?.files[0]?.path).toBe('game.ts'); expect(result).not.toHaveProperty('costUsd');
  expect(onChanges).toHaveBeenCalled(); expect(onTokenUsage).toHaveBeenCalledWith({ inputTokens: 30, outputTokens: 8, cacheReadInputTokens: 10 });
  expect(lease.release).toHaveBeenCalled();
});

it('uses Codex for isolated CoWorker contributions and retains unknown dollar cost', async () => {
  const capture = vi.fn(async (_command: string, args: readonly string[]) => {
    expect(args[0]).toBe('exec'); expect(args).toContain('features.shell_tool=false');
    return envelope({ markdown: '# Independent opinion' });
  });
  const result = await runCouncilProvider({ provider: 'codex', model: 'gpt-6.1-sol', effort: 'medium', instructions: 'Review', prompt: 'Captured task', timeoutSeconds: 30, maxTurns: 5, maxBudgetUsd: 1 }, { executable: 'synthetic-codex', gate: new InvocationGate(), capture });
  expect(result).toMatchObject({ markdown: '# Independent opinion', simulated: false, usage: { inputTokens: 30, cacheReadInputTokens: 10, outputTokens: 8 } });
  expect(result).not.toHaveProperty('costUsd');
});

it('waits for active host calls before closing authority for the final workspace capture', async () => {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'coforge-codex-drain-'))); folders.push(cwd);
  let started!: () => void; let release!: () => void;
  const active = new Promise<void>(resolve => { started = resolve; });
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration() };
  const lease: WorkflowWorkspaceLease = { cwd, capture: async () => undefined, release: async () => {}, validate: async () => { started(); await blocked; throw new Error('Synthetic revoked lease'); } };
  const bridge = await codexWorkflowTools(input, lease);
  const request = fetch(bridge.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${bridge.token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'coforge_read_file', arguments: { path: 'game.ts' } } }) }).catch(() => undefined);
  try {
    await active;
    let closed = false;
    const closing = bridge.dispose().then(() => { closed = true; });
    await request;
    expect(closed).toBe(false);
    release(); await closing;
    expect(closed).toBe(true);
  } finally { release(); await bridge.dispose(); await request; }
});
