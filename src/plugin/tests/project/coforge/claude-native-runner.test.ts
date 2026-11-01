import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { record, text } from '../../../features/coforge/domain/check';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease, WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { runClaudeStage } from '../../../infrastructure/coforge/claude-runner';
import { ProcessOwnershipUnknown, type captureProcess } from '../../../infrastructure/coforge/process';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
const help = '--agents --agent --restricted --strict-mcp-config --permission-prompts --max-budget-usd';
async function fixture() {
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'coforge-native-claude-'))); folders.push(cwd);
  await writeFile(join(cwd, 'game.ts'), 'before'); await mkdir(join(cwd, 'Private')); await writeFile(join(cwd, 'Private/request.md'), 'PRIVATE');
  const lease: WorkflowWorkspaceLease = { cwd, id: 'workspace', protectedProjectPaths: ['Private'], validate: vi.fn(async () => {}),
    capture: vi.fn(async () => undefined), release: vi.fn(async () => {}) };
  const workspaces: WorkflowWorkspaces = { start: async () => {}, acquire: async () => lease, assertReviewable: async () => {}, acknowledge: async () => {} };
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: { ...defaultSettings(), maxTurns: 10 }, integration: defaultIntegration(),
    onConversation: vi.fn(async () => {}), onWorkspace: vi.fn(async () => {}), onNativeProcess: vi.fn(async () => {}),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', output: 'codechange', access: 'editworktree', provider: 'claude', model: 'sonnet',
        instructions: 'Implement using workers.', automatic: false, nativeTools: { delegation: { maxConcurrent: 2 } } } } };
  return { cwd, lease, workspaces, input };
}
it('keeps native coordinator and workers on one protected broker with guarded concurrent writes', async () => {
  const f = await fixture(); let admissions = 0;
  const capture: typeof captureProcess = async (_command, args, options) => {
    if (args[0] === '--version') return '2.1.281 (Claude Code)';
    if (args[0] === '--help') return help;
    admissions++; expect(options.cwd).not.toBe(f.cwd); expect(options.ownedTree).toBe(true);
    await options.onOwnedProcess?.({ pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }, 'launched');
    const definitions = record(JSON.parse(await readFile(args[args.indexOf('--agents') + 1]!, 'utf8')));
    const worker = record(definitions['coforge-worker']);
    expect(worker.tools).toEqual(expect.arrayContaining(['mcp__coforge__coforge_write_file']));
    expect(worker.tools).not.toContain('Agent'); expect(worker.disallowedTools).toContain('Bash');
    expect(worker).toMatchObject({ model: 'inherit', maxTurns: 10, permissionMode: 'dontAsk', omitClaudeMd: true });
    expect(record(definitions['coforge-coordinator']).tools).toContain('Agent(coforge-worker)');
    const config = record(JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8')));
    const server = record(record(config.mcpServers).coforge);
    const call = async (name: string, args: object) => record(await (await fetch(text()(server.url), {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: text()(record(server.headers).Authorization) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    })).json()).result;
    expect(await call('coforge_read_file', { path: 'Private/request.md' })).toMatchObject({ isError: true });
    const writes = await Promise.all(['first-worker', 'second-worker'].map(content => call('coforge_write_file', { path: 'game.ts', content, expectedContent: 'before' })));
    expect(writes.filter(value => !record(value).isError)).toHaveLength(1);
    expect(writes.filter(value => record(value).isError)).toHaveLength(1);
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Workers updated the game; no tests ran.' } });
  };
  expect((await runClaudeStage(f.input, f.workspaces, capture)).summary).toContain('Workers updated');
  expect(admissions).toBe(1); expect(await readFile(join(f.cwd, 'game.ts'), 'utf8')).not.toBe('before');
  expect(f.lease.release).toHaveBeenCalledOnce(); expect(f.input.onWorkspace).toHaveBeenCalledExactlyOnceWith('workspace');
  expect(f.input.onNativeProcess).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'terminated' }));
});
it('refuses an unsupported CLI before a provider request and quarantines uncertain termination', async () => {
  const f = await fixture();
  const unsupported = vi.fn<typeof captureProcess>(async () => '2.1.280 (Claude Code)');
  await expect(runClaudeStage(f.input, f.workspaces, unsupported)).rejects.toThrow('2.1.281');
  expect(unsupported).toHaveBeenCalledOnce(); expect(f.input.onConversation).not.toHaveBeenCalled();
  const unknown: typeof captureProcess = async (_command, args) => {
    if (args[0] === '--version') return '2.1.281'; if (args[0] === '--help') return help;
    throw new ProcessOwnershipUnknown('partial response');
  };
  await expect(runClaudeStage(f.input, f.workspaces, unknown)).rejects.toMatchObject({ name: 'ProcessOwnershipUnknown' });
  expect(f.lease.release).toHaveBeenLastCalledWith(true);
});
it('keeps a successful-looking provider result without structured output unqualified and owned', async () => {
  const f = await fixture();
  const capture: typeof captureProcess = async (_command, args, options) => {
    if (args[0] === '--version') return '2.1.281'; if (args[0] === '--help') return help;
    await options.onOwnedProcess?.({ pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }, 'launched');
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '{"summary":"Unvalidated model claim"}' });
  };
  await expect(runClaudeStage(f.input, f.workspaces, capture)).rejects.toThrow('structured_output');
  expect(f.input.onNativeProcess).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'unknown' }));
  expect(f.lease.release).toHaveBeenLastCalledWith(true);
});
