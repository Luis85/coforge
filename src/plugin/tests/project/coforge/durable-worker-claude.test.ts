import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { expect, it } from 'vitest';
import { record, text } from '../../../features/coforge/domain/check';
import { defaultIntegration } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import { agentGit } from '../../../infrastructure/coforge/agent-worktree';
import { runBackgroundClaude } from '../../../infrastructure/coforge/durable-worker/claude';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { workerWorkspaces } from '../../../infrastructure/coforge/durable-worker/workspaces';
import type { captureProcess } from '../../../infrastructure/coforge/process';
import { durableRequest } from './durable-worker-fixture';

it('uses only its private MCP file tools to edit an isolated worktree and excludes tracked managed notes', async () => {
  await mkdir(resolve('.nq'), { recursive: true });
  const root = await realpath(await mkdtemp(join(resolve('.nq'), 'worker-claude-')));
  if (!root.startsWith(resolve('.nq') + sep)) throw new Error('Unsafe Claude fixture cleanup');
  const repo = join(root, 'game'); await mkdir(repo);
  await mkdir(join(repo, 'CoForge', 'Ideas'), { recursive: true }); await mkdir(join(repo, 'PrivateRequests')); await mkdir(join(repo, '.coforge'));
  await writeFile(join(repo, 'game.ts'), 'export const radius = 1;\n');
  await writeFile(join(repo, 'CoForge', 'Ideas', 'CF-fixture.md'), 'Private managed fixture');
  await writeFile(join(repo, 'PrivateRequests', 'request.md'), 'Custom managed fixture');
  await writeFile(join(repo, '.coforge', 'authority.json'), '{}');
  await agentGit(repo, ['init', '--initial-branch=main']); await agentGit(repo, ['add', '--all']);
  await agentGit(repo, ['-c', 'user.name=CoForge fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--no-gpg-sign', '-m', 'Contained fixture']);
  const files = new WorkerFiles(join(root, 'private')); await files.initialize();
  const workspaces = workerWorkspaces(files); await workspaces.start();
  const request = durableRequest(); let workspaceId: string | undefined; let endpoint = ''; let observedOperations = 0;
  const input: StageInput = { ...request.input, integration: { ...defaultIntegration(), ...request.input.integration, projectPath: repo, worktreeFolder: join(root, 'worktrees') },
    onWorkspace: async id => { workspaceId = id; } };
  const tools = ['coforge_list_files', 'coforge_read_file', 'coforge_search_files', 'coforge_write_file', 'coforge_delete_file'];
  const capture: typeof captureProcess = async (_executable, args, options) => {
    expect(dirname(options.cwd)).toBe(files.directory); expect(options.cwd).not.toBe(repo);
    expect(args).toContain('--restricted'); expect(args).toContain('--strict-mcp-config');
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--allowedTools') + 1]?.split(',')).toEqual(tools.map(name => 'mcp__coforge__' + name));
    const denied = args[args.indexOf('--disallowedTools') + 1]!.split(',');
    for (const name of ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash', 'Agent', 'Task', 'WebFetch', 'WebSearch']) expect(denied).toContain(name);
    expect(denied).not.toContain('mcp__*');
    expect(JSON.parse(args[args.indexOf('--settings') + 1]!)).toMatchObject({ disableAllHooks: true, autoMemoryEnabled: false, claudeMdExcludes: ['**'], enabledPlugins: {} });
    const config = record(JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8')));
    const servers = record(config.mcpServers); expect(Object.keys(servers)).toEqual(['coforge']);
    const server = record(servers.coforge); endpoint = text()(server.url); const headers = record(server.headers);
    const call = async (method: string, params?: object): Promise<unknown> => {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: text()(headers.Authorization) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) }) });
      const body: unknown = await response.json(); return record(body).result;
    };
    expect(await call('tools/list')).toMatchObject({ tools: tools.map(name => ({ name })) });
    expect(await call('tools/call', { name: 'coforge_list_files', arguments: { path: '' } })).toMatchObject({ structuredContent: { files: ['game.ts'] } });
    for (const path of ['CoForge/Ideas/CF-fixture.md', 'PrivateRequests/request.md', '.coforge/authority.json']) {
      expect(await call('tools/call', { name: 'coforge_read_file', arguments: { path } })).toMatchObject({ isError: true });
    }
    expect(await call('tools/call', { name: 'coforge_write_file', arguments: { path: 'PrivateRequests/request.md', content: 'Replaced', expectedContent: 'Custom managed fixture' } })).toMatchObject({ isError: true });
    expect(await call('tools/call', { name: 'coforge_write_file', arguments: { path: 'game.ts', content: 'export const radius = 4;\n', expectedContent: 'export const radius = 1;\n' } })).not.toMatchObject({ isError: true });
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Changed the game radius through the scoped broker.' }, total_cost_usd: 0.01 });
  };
  try {
    const result = await runBackgroundClaude(input, workspaces, files, capture, ['CoForge', 'PrivateRequests'], async () => { observedOperations++; });
    expect(observedOperations).toBe(2); // Successful listing and write; denied requests and contact are not progress.
    expect(result.increment?.files.map(file => file.path)).toEqual(['game.ts']); expect(result.costUsd).toBe(0.01);
    expect(result.increment?.diff).toContain('+export const radius = 4;'); expect(workspaceId).toMatch(/^bg-/u);
    expect(await readFile(join(repo, 'game.ts'), 'utf8')).toBe('export const radius = 1;\n');
    expect(await readFile(join(result.increment!.worktree!, 'PrivateRequests', 'request.md'), 'utf8')).toBe('Custom managed fixture');
    await workspaces.assertReviewable(workspaceId!, result.increment);
    await expect(fetch(endpoint, { method: 'POST' })).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
}, 30000);
