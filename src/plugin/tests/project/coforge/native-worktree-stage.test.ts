import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { runNativeWorktreeStage } from '../../../infrastructure/coforge/native-worktree-stage';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import type { ProcessOptions } from '../../../infrastructure/coforge/process';
import { ProcessFailure, ProcessOwnershipUnknown, type captureProcess } from '../../../infrastructure/coforge/process';
import { providerFailureInfo } from '../../../features/coforge/domain/provider-failure';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';

const folders: string[] = [];
afterEach(async () => { for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'coforge-native-stage-')); folders.push(root); const cwd = join(root, 'worktree'); await mkdir(cwd);
  const order: string[] = [], records: unknown[] = [];
  const lifetime = { version: 1 as const, kind: 'windows-job' as const, directory: join(root, 'controller'), ownerToken: 'a'.repeat(64), sourceHash: 'b'.repeat(64), runId: 'run', attemptId: 'attempt', projectId: 'CFP-001' };
  const identity = { pid: 42, platform: 'win32', birth: 'fixture-birth', image: 'c'.repeat(64) };
  const release = vi.fn(async () => {}), onChanges = vi.fn(async () => { order.push('changes'); });
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: { ...defaultIntegration(), allowImplementation: true, projectPath: '/original/source' }, onChanges,
    onWorkspace: async () => { order.push('workspace'); }, onNativeProcess: async record => { records.push(record); }, onSessionEvent: async () => {},
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], worktreeCoding: { version: 1, profile: 'native-worktree-v1', maxConcurrent: 2 },
      step: { id: 'build', name: 'Build', kind: 'ai', provider: 'claude', model: 'sonnet', instructions: 'Captured task', output: 'codechange', access: 'editworktree', automatic: false,
        nativeTools: { verification: { commandIds: ['old-selection'] } } } } };
  const capture = vi.fn(async summary => ({ summary, files: [{ path: 'game.ts', additions: 1, deletions: 0 }], diff: '+native', tests: ['Not run: shell tools are disabled.'], simulated: false, createdAt: new Date().toISOString() }));
  const workspaces: WorkflowWorkspaces = { start: async () => {}, acknowledge: async () => {}, assertReviewable: async () => {}, acquire: async () => ({ cwd, id: 'owned-workspace', validate: async () => {}, capture, release }) };
  const probe = vi.fn<typeof captureProcess>(async (_command, args) => args[0] === '--version' ? '2.1.281' : '--agents --restricted --permission-prompts --append-system-prompt --tools --max-budget-usd');
  return { root, cwd, input, order, records, lifetime, identity, capture, release, onChanges, workspaces, probe };
}
it('runs ordinary coding in the owned worktree, records ownership before task input and preserves actual changes without Docker claims', async () => {
  const f = await fixture();
  const capture = async (_command: string, args: readonly string[], options: ProcessOptions) => {
    expect(f.order).toEqual(['workspace']); expect(options.cwd).toBe(f.cwd); expect(options.nativeCoding).toMatchObject({ runId: 'run', attemptId: 'attempt' });
    expect(args[args.indexOf('--tools') + 1]).toContain('Bash'); expect(args.join(' ')).not.toContain('coforge_run_tests');
    await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime); await writeFile(join(f.cwd, 'game.ts'), 'native');
    await options.onOwnedProcess?.(f.identity, 'terminated', f.lifetime);
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Native increment' }, total_cost_usd: 0.2 });
  };
  const result = await runNativeWorktreeStage(f.input, f.workspaces, { provider: 'claude', capture, probe: f.probe });
  expect(result.summary).toBe('Native increment'); expect(await readFile(join(f.cwd, 'game.ts'), 'utf8')).toBe('native');
  expect(result.increment?.tests.join(' ')).not.toContain('shell tools are disabled'); expect(result.increment?.tests.join(' ')).toContain('native');
  expect(result.increment?.verification).toBeUndefined(); expect(f.onChanges).toHaveBeenCalledOnce(); expect(f.release).toHaveBeenCalledWith(undefined);
});
it('does not turn malformed output into unknown resource ownership after the controller proved all descendants stopped', async () => {
  const f = await fixture();
  let error: unknown;
  try { await runNativeWorktreeStage(f.input, f.workspaces, { provider: 'claude', probe: f.probe, capture: async (_command, _args, options) => {
    await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime); await options.onOwnedProcess?.(f.identity, 'terminated', f.lifetime);
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { invalid: true } });
  } }); } catch (caught) { error = caught; }
  expect(providerFailureInfo(error)?.code).toBe('output_validation'); expect(error).not.toBeInstanceOf(ProcessOwnershipUnknown);
  expect(f.capture).toHaveBeenCalledOnce(); expect(f.release).toHaveBeenCalledWith(undefined);
});
it('refuses to accept root JSON as a descendant-lifetime proof and preserves a background policy with no elapsed deadline', async () => {
  const f = await fixture(); f.input.workflow!.step.execution = { mode: 'background' };
  await expect(runNativeWorktreeStage(f.input, f.workspaces, { provider: 'claude', probe: f.probe, capture: async (_command, _args, options) => {
    expect(options.timeoutMs).toBeUndefined(); await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime);
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Root final is insufficient' } });
  } })).rejects.toBeInstanceOf(ProcessOwnershipUnknown);
  expect(f.release).toHaveBeenCalledWith(true); expect(f.capture).not.toHaveBeenCalled(); expect(f.onChanges).not.toHaveBeenCalled();
});
it('retains known cumulative spend and actual partial edits after interrupted continuation without accepting the earlier result', async () => {
  for (const unknown of [false, true]) {
    const f = await fixture(); const onUsage = vi.fn(async () => {}), onTokenUsage = vi.fn(async () => {});
    f.input.onUsage = onUsage; f.input.onTokenUsage = onTokenUsage;
    const raw = [{ type: 'system', subtype: 'init', session_id: 'root' },
      { type: 'assistant', session_id: 'root', message: { content: [{ type: 'tool_use', name: 'Agent', id: 'native' }] } },
      { type: 'result', subtype: 'success', session_id: 'root', is_error: false, structured_output: { summary: 'Unverified earlier root' }, total_cost_usd: 0.2,
        modelUsage: { selected: { inputTokens: 70, outputTokens: 70, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } },
      { type: 'system', subtype: 'init', session_id: 'root' }].map(value => JSON.stringify(value)).join('\n');
    let caught: unknown;
    try { await runNativeWorktreeStage(f.input, f.workspaces, { provider: 'claude', probe: f.probe, capture: async (_command, _args, options) => {
      await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime); await options.onOwnedProcess?.(f.identity, unknown ? 'unknown' : 'terminated', f.lifetime);
      if (unknown) throw new ProcessOwnershipUnknown(raw);
      throw new ProcessFailure('Run timed out.', raw);
    } }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(unknown ? ProcessOwnershipUnknown : ProcessFailure);
    expect(onUsage).toHaveBeenCalledWith(0.2); expect(onTokenUsage).toHaveBeenCalledWith({ inputTokens: 70, outputTokens: 70, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });
    expect(f.onChanges).toHaveBeenCalledTimes(unknown ? 0 : 1); expect(f.capture).toHaveBeenCalledTimes(unknown ? 0 : 1);
    expect(f.release).toHaveBeenCalledWith(unknown || undefined);
  }
});
it('uses managed completion for an attached coding step without CLI turn, spending or task-duration stops', async () => {
  const f = await fixture(); f.input.workflow!.lifecycle = { version: 1, mode: 'managed-session' };
  const result = await runNativeWorktreeStage(f.input, f.workspaces, { provider: 'claude', probe: f.probe, capture: async (_command, args, options) => {
    expect(options.timeoutMs).toBeUndefined(); expect(args).not.toContain('--max-turns'); expect(args).not.toContain('--max-budget-usd');
    expect(JSON.parse(args[args.indexOf('--agents') + 1]!)['coforge-native-coder']).not.toHaveProperty('maxTurns');
    await options.onOwnedProcess?.(f.identity, 'launched', f.lifetime); await options.onOwnedProcess?.(f.identity, 'terminated', f.lifetime);
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Completed with normal tools' } });
  } });
  expect(result.summary).toBe('Completed with normal tools'); expect(f.release).toHaveBeenCalledWith(undefined);
});
