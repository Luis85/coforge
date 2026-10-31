import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { record, text } from '../../../features/coforge/domain/check';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { runClaudeStage } from '../../../infrastructure/coforge/claude-runner';
import { ProcessFailure, type captureProcess } from '../../../infrastructure/coforge/process';
import { ai } from './configured-workflow-fixture';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe reader fixture cleanup');
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
async function fixture() {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'claude-read-'))); roots.push(root);
  await mkdir(join(root, 'PrivateRequests')); await writeFile(join(root, 'PrivateRequests', 'CF-private.md'), 'Private request');
  await writeFile(join(root, 'game.ts'), 'export const radius = 1;\n');
  await agentGit(root, ['init', '--initial-branch=main']); await agentGit(root, ['add', '--all']);
  await agentGit(root, ['-c', 'user.name=CoForge fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Contained reader fixture']);
  await writeFile(join(root, 'game.ts'), 'export const radius = 2;\n');
  const before = await agentGit(root, ['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD']);
  const lease = {
    id: 'bg-original-build', cwd: root, readOnly: true as const, protectedProjectPaths: ['PrivateRequests'],
    validate: vi.fn(async () => {
      if (await agentGit(root, ['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD']) !== before) throw new Error('Original Build workspace changed; inspect the original evidence.');
    }),
    capture: vi.fn(async () => undefined), release: vi.fn(async () => undefined),
  };
  const workspaces: WorkflowWorkspaces = { start: vi.fn(), acquire: vi.fn(async () => lease), assertReviewable: vi.fn(), acknowledge: vi.fn() };
  const input: StageInput = {
    stage: 'plan', idea: createSeed().ideas[0]!,
    settings: { ...defaultSettings(), timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1 }, integration: defaultIntegration(),
    workflow: { runId: 'original-run', attemptId: 'read-attempt', proposalRevision: 'proposal', definitionRevision: 'definition',
      step: { ...ai('review', 'markdown', 'readproject'), provider: 'claude', model: 'sonnet', effort: 'high' }, inputArtifacts: [], workspaceId: lease.id },
    onWorkspace: vi.fn(async () => undefined), onChanges: vi.fn(async () => undefined),
    onUsage: vi.fn(async () => undefined), onTokenUsage: vi.fn(async () => undefined), onConversation: vi.fn(async () => undefined),
  };
  return { root, before, lease, workspaces, input };
}
const output = () => JSON.stringify({ type: 'result', subtype: 'success', is_error: false,
  structured_output: { markdown: 'Reviewed the preserved Build changes.' }, total_cost_usd: 0.2, usage: { input_tokens: 7, output_tokens: 3 } });
async function broker(args: readonly string[]) {
  const config: unknown = JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8'));
  const server = record(record(record(config).mcpServers).coforge);
  const url = text()(server.url); const authorization = text()(record(server.headers).Authorization);
  return {
    url,
    call: async (method: string, params?: unknown) => {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }) });
      const value: unknown = await response.json(); return record(value).result;
    },
  };
}

it('reads the original Build only through three protected MCP tools from a private cwd, retaining its diff and short caps', async () => {
  const f = await fixture(); let temporary = ''; let endpoint = '';
  const capture: typeof captureProcess = async (_command, args, options) => {
    temporary = options.cwd;
    expect(temporary).not.toBe(f.root); expect(temporary.startsWith(f.root + sep)).toBe(false);
    expect(options.timeoutMs).toBe(180_000); expect(options.input).toContain(f.input.idea.title);
    expect(args[args.indexOf('--system-prompt') + 1]).toContain('Instructions for review');
    expect(args).toContain('--restricted'); expect(args).toContain('--strict-mcp-config');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    const names = ['coforge_list_files', 'coforge_read_file', 'coforge_search_files'];
    expect(args[args.indexOf('--allowedTools') + 1]?.split(',')).toEqual(names.map(name => 'mcp__coforge__' + name));
    for (const name of ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash', 'Agent', 'Task', 'WebFetch', 'WebSearch']) {
      expect(args[args.indexOf('--disallowedTools') + 1]?.split(',')).toContain(name);
    }
    expect(args[args.indexOf('--max-turns') + 1]).toBe('12'); expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('1');
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet'); expect(args[args.indexOf('--effort') + 1]).toBe('high');
    const connection = await broker(args); endpoint = connection.url;
    expect(await connection.call('tools/list')).toMatchObject({ tools: names.map(name => ({ name })) });
    expect(await connection.call('tools/call', { name: names[0], arguments: { path: '' } })).toMatchObject({ structuredContent: { files: ['game.ts'] } });
    expect(await connection.call('tools/call', { name: names[1], arguments: { path: 'game.ts' } })).toMatchObject({ structuredContent: { content: 'export const radius = 2;\n' } });
    expect(await connection.call('tools/call', { name: names[2], arguments: { query: 'radius' } })).not.toMatchObject({ isError: true });
    expect(await connection.call('tools/call', { name: names[1], arguments: { path: 'PrivateRequests/CF-private.md' } })).toMatchObject({ isError: true });
    expect(await connection.call('tools/call', { name: 'coforge_write_file', arguments: { path: 'game.ts', content: 'overwritten' } })).toMatchObject({ isError: true });
    return output();
  };
  const result = await runClaudeStage(f.input, f.workspaces, capture);
  expect(result).toMatchObject({ markdown: 'Reviewed the preserved Build changes.', costUsd: 0.2 });
  expect(result.increment).toBeUndefined(); expect(f.lease.capture).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled();
  expect(f.lease.validate.mock.calls.length).toBeGreaterThanOrEqual(4); expect(f.lease.release).toHaveBeenCalledTimes(1);
  expect(f.input.onWorkspace).toHaveBeenCalledWith(f.lease.id); expect(f.input.onUsage).toHaveBeenCalledWith(0.2);
  expect(f.input.onTokenUsage).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 7, outputTokens: 3 }));
  expect(f.input.onConversation).toHaveBeenCalledWith(expect.objectContaining({ kind: 'request' }));
  expect(f.input.onConversation).toHaveBeenCalledWith(expect.objectContaining({ kind: 'response' }));
  expect(await agentGit(f.root, ['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD'])).toBe(f.before);
  await expect(stat(temporary)).rejects.toThrow(); await expect(fetch(endpoint)).rejects.toThrow();
}, 30_000);

it.each(['process', 'schema'] as const)('preserves the Build diff on a %s failure without foreground capture or leaked broker', async failure => {
  const f = await fixture(); let temporary = ''; let endpoint = '';
  const capture: typeof captureProcess = async (_command, args, options) => {
    temporary = options.cwd; endpoint = (await broker(args)).url;
    if (failure === 'process') throw new ProcessFailure('Original process failed.', output());
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { unknown: true } });
  };
  await expect(runClaudeStage(f.input, f.workspaces, capture)).rejects.toThrow(failure === 'process' ? 'Original process failed' : 'schema validation');
  expect(f.lease.capture).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled(); expect(f.lease.release).toHaveBeenCalledTimes(1);
  expect(await agentGit(f.root, ['diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD'])).toBe(f.before);
  await expect(stat(temporary)).rejects.toThrow(); await expect(fetch(endpoint)).rejects.toThrow();
  if (failure === 'process') { expect(f.input.onUsage).toHaveBeenCalledWith(0.2); expect(f.input.onConversation).toHaveBeenCalledWith(expect.objectContaining({ kind: 'response' })); }
}, 30_000);

it.each(['missing-protection', 'missing-readonly', 'missing-validator', 'write-access'] as const)('refuses %s qualification without native dispatch, capture or workspace adoption', async mode => {
  const f = await fixture();
  const malformed = {
    ...f.lease,
    ...(mode === 'missing-protection' ? { protectedProjectPaths: undefined } : {}),
    ...(mode === 'missing-readonly' ? { readOnly: undefined } : {}),
    ...(mode === 'missing-validator' ? { validate: undefined } : {}),
  };
  if (mode === 'write-access') f.input.workflow!.step.access = 'editworktree';
  const workspaces: WorkflowWorkspaces = { ...f.workspaces, acquire: async () => malformed };
  const capture = vi.fn<typeof captureProcess>(async () => output());
  await expect(runClaudeStage(f.input, workspaces, capture)).rejects.toThrow(/qualified|read-only|readproject/i);
  expect(capture).not.toHaveBeenCalled(); expect(f.lease.capture).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled();
  expect(f.input.onWorkspace).not.toHaveBeenCalled(); expect(f.lease.release).toHaveBeenCalledTimes(1);
}, 30_000);

it('revalidates the original workspace before dispatch and each broker read, rejecting changed evidence', async () => {
  const f = await fixture();
  const capture: typeof captureProcess = async (_command, args) => {
    const connection = await broker(args);
    await writeFile(join(f.root, 'game.ts'), 'Changed outside the verified Build');
    expect(await connection.call('tools/call', { name: 'coforge_read_file', arguments: { path: 'game.ts' } })).toMatchObject({ isError: true });
    return output();
  };
  await expect(runClaudeStage(f.input, f.workspaces, capture)).rejects.toThrow('Original Build workspace changed');
  expect(f.lease.validate.mock.calls.length).toBeGreaterThanOrEqual(2); expect(f.lease.capture).not.toHaveBeenCalled();
  expect(f.input.onUsage).toHaveBeenCalledWith(0.2);
  const second = await fixture(); await writeFile(join(second.root, 'game.ts'), 'Changed before dispatch');
  const dispatch = vi.fn<typeof captureProcess>(async () => output());
  await expect(runClaudeStage(second.input, second.workspaces, dispatch)).rejects.toThrow('Original Build workspace changed');
  expect(dispatch).not.toHaveBeenCalled(); expect(second.input.onWorkspace).not.toHaveBeenCalled(); expect(second.lease.release).toHaveBeenCalledTimes(1);
}, 30_000);

it('retains reported cost and conversation when the captured read-tool bound is exceeded', async () => {
  const f = await fixture(); f.input.settings.maxTurns = 1;
  const capture: typeof captureProcess = async (_command, args) => {
    const connection = await broker(args);
    await connection.call('tools/call', { name: 'coforge_list_files', arguments: { path: '' } });
    expect(await connection.call('tools/call', { name: 'coforge_read_file', arguments: { path: 'game.ts' } })).toMatchObject({ isError: true });
    return output();
  };
  await expect(runClaudeStage(f.input, f.workspaces, capture)).rejects.toThrow('captured CoForge read-tool call limit');
  expect(f.input.onUsage).toHaveBeenCalledWith(0.2);
  expect(f.input.onConversation).toHaveBeenCalledWith(expect.objectContaining({ kind: 'response' }));
  expect(f.lease.capture).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled();
}, 30_000);

it('never dispatches when saving the scoped request fails, and preserves the earlier Build', async () => {
  const f = await fixture();
  f.input.onConversation = vi.fn(async () => { throw new Error('Request evidence could not be saved.'); });
  const capture = vi.fn<typeof captureProcess>(async () => output());
  await expect(runClaudeStage(f.input, f.workspaces, capture)).rejects.toThrow('Request evidence could not be saved');
  expect(capture).not.toHaveBeenCalled(); expect(f.lease.release).toHaveBeenCalledTimes(1);
  expect(f.lease.capture).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled();
}, 30_000);

it('passes cancellation to the short provider call and closes its read broker without recapturing the Build', async () => {
  const f = await fixture(); const controller = new AbortController(); f.input.signal = controller.signal;
  let endpoint = ''; let temporary = '';
  const capture: typeof captureProcess = async (_command, args, options) => {
    expect(options.signal).toBe(controller.signal); temporary = options.cwd; endpoint = (await broker(args)).url;
    controller.abort(); throw new ProcessFailure('Run cancelled.', output());
  };
  await expect(runClaudeStage(f.input, f.workspaces, capture)).rejects.toThrow('Run cancelled');
  expect(f.lease.capture).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled(); expect(f.lease.release).toHaveBeenCalledTimes(1);
  expect(f.input.onUsage).toHaveBeenCalledWith(0.2); await expect(fetch(endpoint)).rejects.toThrow(); await expect(stat(temporary)).rejects.toThrow();
}, 30_000);
