import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { buildClaudeArgs } from '../../../features/coforge/application/claude-protocol';
import { buildNativeClaudeArgs } from '../../../features/coforge/application/native-coding-protocol';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { runClaudeStage } from '../../../infrastructure/coforge/claude-runner';
import { ProcessOwnershipUnknown, type ProcessOptions } from '../../../infrastructure/coforge/process';
import { record, text } from '../../../features/coforge/domain/check';
import { writeCodexModelProfile } from '../../../infrastructure/coforge/codex-model-profile';
import { codexResult } from '../../../features/coforge/application/codex-protocol';
import { managedSessionCapture } from '../../../infrastructure/coforge/managed-session-capture';

const roots: string[] = [];
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
afterEach(async () => {
  Object.defineProperty(process, 'platform', platform);
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) {
    if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe managed-session fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
it('uses a configured CLI catalogue for restricted managed sessions without requiring an earlier global model cache', async () => {
  const f = await fixture(); const home = join(f.root, 'empty-home'); await mkdir(home); vi.stubEnv('CODEX_HOME', home);
  const file = await writeCodexModelProfile(f.root, 'fixture-selected', undefined, { models: [{ slug: 'fixture-selected', tool_mode: 'code_mode_only', base_instructions: 'Provider metadata' }] });
  expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ models: [{ slug: 'fixture-selected', tool_mode: 'direct', experimental_supported_tools: [], multi_agent_version: null }] });
  await expect(writeCodexModelProfile(join(f.root, 'legacy'), 'fixture-selected')).rejects.toThrow('model metadata is unavailable');
});
const lifecycle = { version: 1 as const, mode: 'managed-session' as const };
function input(): StageInput {
  return { stage: 'plan', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' }, settings: { ...defaultSettings(), timeoutSeconds: 15, maxTurns: 1, maxBudgetUsd: 0.1 },
    integration: defaultIntegration(), workflow: { runId: 'run', attemptId: 'refine', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], lifecycle,
      step: { id: 'refine', name: 'Refinement', kind: 'ai', provider: 'claude', model: 'sonnet', instructions: 'Refine the specification', output: 'markdown', access: 'readproject', automatic: false } },
    onNativeProcess: vi.fn(async () => {}), onWorkspace: vi.fn(async () => {}), onConversation: vi.fn(async () => {}), onChanges: vi.fn(async () => {}) };
}
const response = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { markdown: '# Refined specification' }, total_cost_usd: 0.2 });
async function fixture() {
  await mkdir('.nq', { recursive: true }); const root = await mkdtemp(join(resolve('.nq'), 'managed-refinement-')); roots.push(root);
  await writeFile(join(root, 'game.ts'), 'export const radius = 2;\n');
  const release = vi.fn(async () => {}), capture = vi.fn(async () => undefined);
  const lease = { id: 'preserved-workspace', cwd: root, readOnly: true as const, protectedProjectPaths: [], validate: vi.fn(async () => {}), capture, release };
  const workspaces = { start: async () => {}, acquire: async () => lease, assertReviewable: async () => {}, acknowledge: async () => {} };
  const identity = { pid: 42, platform: 'win32', birth: '123', image: 'a'.repeat(64) };
  const lifetime = { version: 1 as const, kind: 'windows-job' as const, directory: join(root, 'controller'), ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64), runId: 'run', attemptId: 'refine', projectId: 'CFP-001' };
  return { root, release, capture, workspaces, identity, lifetime };
}

it('omits task-duration, turn and spending stops only for newly captured managed workflow sessions', () => {
  const managed = input(); const legacy = { ...managed.workflow!, lifecycle: undefined };
  expect(buildClaudeArgs('plan', managed.settings, managed.workflow)).not.toContain('--max-turns');
  expect(buildClaudeArgs('plan', managed.settings, managed.workflow)).not.toContain('--max-budget-usd');
  expect(buildClaudeArgs('plan', managed.settings, legacy)).toContain('--max-turns');
  const coding = { model: 'sonnet', schema: { type: 'object' }, instructions: 'Build', nativeCoding: { version: 1 as const, profile: 'native-worktree-v1' as const, maxConcurrent: 2 }, managedSession: true };
  const args = buildNativeClaudeArgs(managed.settings, coding);
  expect(args).not.toContain('--max-turns'); expect(args).not.toContain('--max-budget-usd');
  expect(JSON.parse(args[args.indexOf('--agents') + 1]!)['coforge-native-coder']).not.toHaveProperty('maxTurns');
  expect(buildNativeClaudeArgs(managed.settings, { ...coding, managedSession: false })).toContain('--max-turns');
});
it('records a closed Codex turn without a final root answer as incomplete instead of losing its cause', () => {
  let failure: unknown;
  try { codexResult(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 0, cached_input_tokens: 0 } })); } catch (error) { failure = error; }
  expect(failure).toMatchObject({ failure: { code: 'incomplete_output' } });
});

it('lets a read-only refinement complete after repeated scoped reads without a foreground timer or coding grant', async () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const f = await fixture(); const managed = input();
  const capture = async (_command: string, args: readonly string[], options: ProcessOptions) => {
    expect(options.timeoutMs).toBeUndefined(); expect(options.nativeCoding).toEqual({ runId: 'run', attemptId: 'refine', projectId: 'CFP-001' });
    expect(args).not.toContain('--max-turns'); expect(args).not.toContain('--max-budget-usd');
    expect(args[args.indexOf('--tools') + 1]).not.toContain('Bash');
    await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime);
    const config = record(JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8')));
    const server = record(record(config.mcpServers).coforge), url = text()(server.url), authorization = text()(record(server.headers).Authorization);
    for (let count = 0; count < 3; count++) {
      const result = await fetch(url, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: count, method: 'tools/call', params: { name: 'coforge_read_file', arguments: { path: 'game.ts' } } }) });
      expect(record(record(await result.json()).result).isError).not.toBe(true);
    }
    await options.onOwnedProcess?.(f.identity, 'terminated', f.lifetime); return response;
  };
  const result = await runClaudeStage(managed, f.workspaces, capture);
  expect(result.markdown).toBe('# Refined specification'); expect(f.capture).not.toHaveBeenCalled(); expect(managed.onChanges).not.toHaveBeenCalled();
  expect(managed.onNativeProcess).toHaveBeenCalledWith(expect.objectContaining({ phase: 'terminated', lifetime: f.lifetime }));
  expect(f.release).toHaveBeenCalledWith(undefined);
});

it('cannot promote a semantic result when a managed refinement has no original descendant-stop proof', async () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  const f = await fixture(); const managed = input();
  await expect(runClaudeStage(managed, f.workspaces, async (_command, _args, options) => {
    await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime); return response;
  })).rejects.toBeInstanceOf(ProcessOwnershipUnknown);
  expect(f.release).toHaveBeenCalledWith(true); expect(f.capture).not.toHaveBeenCalled(); expect(managed.onChanges).not.toHaveBeenCalled();
});

it('keeps managed Linux refinement on its restricted read broker without inventing Windows ownership', async () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  const f = await fixture(); const managed = input(); managed.onNativeProcess = undefined;
  const result = await runClaudeStage(managed, f.workspaces, async (_command, args, options) => {
    expect(options.managedSession).toBe(true); expect(options.timeoutMs).toBeUndefined();
    expect(options.nativeCoding).toBeUndefined(); expect(options.ownedTree).toBeUndefined(); expect(options.onOwnedProcess).toBeUndefined();
    expect(args).not.toContain('--max-turns'); expect(args).not.toContain('--max-budget-usd');
    expect(args[args.indexOf('--tools') + 1]).not.toContain('Bash');
    const config = record(JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8')));
    const server = record(record(config.mcpServers).coforge), url = text()(server.url), authorization = text()(record(server.headers).Authorization);
    for (let count = 0; count < 4; count++) {
      const read = await fetch(url, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: count, method: 'tools/call', params: { name: 'coforge_read_file', arguments: { path: 'game.ts' } } }) });
      expect(record(record(await read.json()).result).isError).not.toBe(true);
    }
    return response;
  });
  expect(result.markdown).toBe('# Refined specification'); expect(f.capture).not.toHaveBeenCalled();
  expect(managed.onChanges).not.toHaveBeenCalled(); expect(f.release).toHaveBeenCalledWith(undefined);
  expect(await readFile(join(f.root, 'game.ts'), 'utf8')).toBe('export const radius = 2;\n');
});

it('retains existing scoped Linux delegation completion and bounded setup queries without claiming a Windows receipt', async () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  const f = await fixture(); const managed = input(); managed.workflow!.step.nativeTools = { delegation: { maxConcurrent: 1 } };
  const result = await runClaudeStage(managed, f.workspaces, async (_command, args, options) => {
    expect(options.nativeCoding).toBeUndefined();
    if (args.includes('--version') || args.includes('--help')) {
      expect(options.managedSession).toBeUndefined(); expect(options.timeoutMs).toBe(5000);
      return args.includes('--version') ? 'Claude Code 2.1.281' : '--agents --agent --restricted --strict-mcp-config --permission-prompts --max-budget-usd';
    }
    expect(options.managedSession).toBe(true); expect(options.ownedTree).toBe(true); expect(options.timeoutMs).toBeUndefined();
    await options.onOwnedProcess?.({ ...f.identity, platform: 'linux', groupId: 42 }, 'launched'); return response;
  });
  expect(result.markdown).toBe('# Refined specification');
  expect(managed.onNativeProcess).toHaveBeenCalledWith(expect.objectContaining({ phase: 'terminated', identity: expect.objectContaining({ platform: 'linux' }) }));
  expect(managed.onNativeProcess).not.toHaveBeenCalledWith(expect.objectContaining({ lifetime: expect.anything() }));
  expect(f.release).toHaveBeenCalledWith(undefined); expect(f.capture).not.toHaveBeenCalled();
});

it('retains an actual POSIX original privately on uncertainty and records unknown through the existing callback', async () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  const f = await fixture(), managed = input(), original = { ...f.identity, platform: 'linux', groupId: 42 };
  const error = new ProcessOwnershipUnknown(response, undefined, undefined, undefined, original);
  const observe = vi.fn<NonNullable<ProcessOptions['onOwnedProcess']>>(async () => {});
  const capture = managedSessionCapture(managed, 'codex', async () => { throw error; });
  await expect(capture('synthetic-cli', [], { cwd: f.root, input: 'authorized prompt', onOwnedProcess: observe })).rejects.toBe(error);
  expect(observe.mock.calls.map(call => call[1])).toEqual(['launched', 'unknown']);
  expect(observe).toHaveBeenCalledWith(original, 'unknown'); expect(managed.onNativeProcess).not.toHaveBeenCalled();
  expect(error.originalIdentity).toEqual(original); expect(Object.keys(error)).not.toContain('originalIdentity');
  expect(JSON.stringify(error)).not.toContain(original.image);
  const fallback = managedSessionCapture(managed, 'claude', async () => { throw error; });
  await expect(fallback('synthetic-cli', [], { cwd: f.root, input: 'authorized prompt' })).rejects.toBe(error);
  expect(managed.onNativeProcess).toHaveBeenCalledWith(expect.objectContaining({ identity: original, phase: 'unknown' }));
  expect(managed.onNativeProcess).not.toHaveBeenCalledWith(expect.objectContaining({ lifetime: expect.anything() }));
});
