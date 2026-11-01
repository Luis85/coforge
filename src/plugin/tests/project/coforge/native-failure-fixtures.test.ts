import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { captureProcess, ProcessOwnershipUnknown } from '../../../infrastructure/coforge/process';
import { diagnoseProviderFailure, preserveProviderFailure } from '../../../infrastructure/coforge/provider-failure';
import { ProviderFailureError, providerFailureFor, providerFailureInfo } from '../../../features/coforge/domain/provider-failure';
import { runBackgroundClaude } from '../../../infrastructure/coforge/durable-worker/claude';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';

it('classifies a real failed fixture process without hiding its unverified ownership or exposing diagnostics', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-native-failure-'));
  try {
    let caught: unknown;
    try { await captureProcess(process.execPath, ['-e', "process.stdin.resume();process.stdin.on('end',()=>{process.stderr.write('401 Unauthorized invalid_api_key Bearer PRIVATE_SECRET /private/auth.json');process.exitCode=3});"], { cwd: directory, ownedTree: true }); }
    catch (error) { caught = diagnoseProviderFailure('codex', error); }
    expect(caught).toBeInstanceOf(ProcessOwnershipUnknown);
    expect(providerFailureInfo(caught)?.code).toBe('authentication');
    expect(caught instanceof Error && caught.message).toMatch(/quarantin|unverified/u);
    expect(caught instanceof Error && caught.message).not.toMatch(/PRIVATE_SECRET|auth\.json/u);
    expect(providerFailureInfo(caught)?.nextStep).toContain('confirm it has stopped');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('retains partial native Claude changes and reported spend when the actual fixture emits a budget failure', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-native-failure-')));
  const cwd = join(root, 'source'); await mkdir(cwd);
  const files = new WorkerFiles(join(root, 'private')); await files.initialize();
  const script = join(root, 'provider.cjs');
  await writeFile(script, "const fs=require('node:fs');process.stdin.resume();process.stdin.on('end',()=>{fs.writeFileSync(process.argv[2],'after');console.log(JSON.stringify({type:'system',subtype:'init',session_id:'root'}));console.log(JSON.stringify({type:'result',subtype:'error_max_budget_usd',is_error:true,total_cost_usd:0.25,errors:['PRIVATE_PROVIDER_BODY']}));});");
  const release = vi.fn(async () => {}), onChanges = vi.fn(async () => {}), onUsage = vi.fn(async () => {});
  const workspaces: WorkflowWorkspaces = { start: async () => {}, assertReviewable: async () => {}, acknowledge: async () => {}, acquire: async () => ({ cwd, id: 'bg-owned',
    capture: async () => ({ summary: 'Retained change', files: [{ path: 'game.ts', additions: 1, deletions: 0 }], diff: '+after', tests: [], simulated: false, createdAt: new Date().toISOString() }), release }) };
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(), onChanges, onUsage, onSessionEvent: async () => {},
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [], step: { id: 'build', name: 'Build', kind: 'ai', output: 'codechange', access: 'editworktree', provider: 'claude', model: 'sonnet', instructions: 'Build', automatic: false, nativeTools: { delegation: { maxConcurrent: 1 } } } } };
  const fixture = async (_command: string, _args: readonly string[], options: Parameters<typeof captureProcess>[2]) => captureProcess(process.execPath, [script, join(cwd, 'game.ts')], options);
  const probe = vi.fn<typeof captureProcess>(async (_command, args) => args[0] === '--version' ? '2.1.281' : '--agents --agent --restricted --strict-mcp-config --permission-prompts --max-budget-usd');
  try {
    let failed: unknown;
    try { await runBackgroundClaude(input, workspaces, files, fixture, [], undefined, probe); } catch (error) { failed = error; }
    expect(failed).toBeInstanceOf(ProcessOwnershipUnknown); expect(providerFailureInfo(failed)?.code).toBe('budget_limit');
    expect(failed instanceof Error && failed.message).not.toContain('PRIVATE_PROVIDER_BODY');
    expect(await readFile(join(cwd, 'game.ts'), 'utf8')).toBe('after');
    expect(onUsage).toHaveBeenCalledWith(0.25); expect(onChanges).toHaveBeenCalledWith(expect.objectContaining({ files: [{ path: 'game.ts', additions: 1, deletions: 0 }] }));
    expect(release).toHaveBeenCalledWith(true);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 20000);

it('preserves the reported cause across cleanup failures while uncertainty still wins', () => {
  const primary = new ProviderFailureError(providerFailureFor('model_access'));
  expect(preserveProviderFailure(primary, new Error('Private cleanup error'))).toBe(primary);
  const uncertain = preserveProviderFailure(primary, new ProcessOwnershipUnknown(''));
  expect(uncertain).toBeInstanceOf(ProcessOwnershipUnknown); expect(providerFailureInfo(uncertain)?.code).toBe('model_access');
  expect(providerFailureInfo(uncertain)?.nextStep).toContain('confirm it has stopped');
});
