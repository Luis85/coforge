import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../../infrastructure/coforge/codex-workflow-tools', async importOriginal => {
  const original = await importOriginal<typeof import('../../../infrastructure/coforge/codex-workflow-tools')>();
  const { ProcessOwnershipUnknown } = await import('../../../infrastructure/coforge/process');
  return { ...original, codexWorkflowTools: async (...args: Parameters<typeof original.codexWorkflowTools>) => {
    const bridge = await original.codexWorkflowTools(...args);
    return { ...bridge, dispose: async () => { await bridge.dispose(); throw new ProcessOwnershipUnknown(''); } };
  } };
});
import { runClaudeStage } from '../../../infrastructure/coforge/claude-runner';
import { runBackgroundClaude } from '../../../infrastructure/coforge/durable-worker/claude';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease, WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { ProcessOwnershipUnknown, type captureProcess } from '../../../infrastructure/coforge/process';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
it.each(['foreground', 'durable'] as const)('retains actual %s code changes even when verification cleanup refuses ownership release', async mode => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-claude-retention-'))); folders.push(root);
  const cwd = join(root, 'source'); await mkdir(cwd);
  const increment = { ...createSeed().ideas.find(idea => idea.increment)!.increment!, simulated: false, summary: 'Actual retained changes', worktree: cwd };
  const lease: WorkflowWorkspaceLease = { cwd, id: mode === 'durable' ? 'bg-original' : 'original', protectedProjectPaths: [], capture: vi.fn(async () => increment), release: vi.fn(async () => {}) };
  const workspaces: WorkflowWorkspaces = { start: async () => {}, acquire: async () => lease, assertReviewable: async () => {}, acknowledge: async () => {} };
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    onNativeProcess: vi.fn(async () => {}), onChanges: vi.fn(async () => {}),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', output: 'codechange', access: 'editworktree', provider: 'claude', model: 'sonnet', instructions: 'Build', automatic: false, nativeTools: { delegation: { maxConcurrent: 1 } } } } };
  const capture: typeof captureProcess = async (_command, args, options) => {
    if (args[0] === '--version') return '2.1.281'; if (args[0] === '--help') return '--agents --agent --restricted --strict-mcp-config --permission-prompts --max-budget-usd';
    await options.onOwnedProcess?.({ pid: 123, platform: process.platform, birth: 'original', image: 'a'.repeat(64) }, 'launched');
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Actual retained changes' } });
  };
  const files = new WorkerFiles(join(root, 'private')); await files.initialize();
  const execution = mode === 'durable' ? runBackgroundClaude(input, workspaces, files, capture, [], undefined, capture) : runClaudeStage(input, workspaces, capture);
  await expect(execution).rejects.toBeInstanceOf(ProcessOwnershipUnknown);
  expect(input.onChanges).toHaveBeenCalledExactlyOnceWith(increment);
  expect(lease.release).toHaveBeenLastCalledWith(true);
});
