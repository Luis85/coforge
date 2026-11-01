import { mkdtemp, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { WorkerFiles } from '../../../infrastructure/coforge/durable-worker/files';
import { runBackgroundClaude } from '../../../infrastructure/coforge/durable-worker/claude';
import type { captureProcess } from '../../../infrastructure/coforge/process';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
it('uses the same trusted native delegation profile durably without treating unpaid probes as provider admissions', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'coforge-native-durable-'))); folders.push(root);
  const cwd = join(root, 'source'); await mkdir(cwd);
  const files = new WorkerFiles(join(root, 'private')); await files.initialize();
  const workspaces: WorkflowWorkspaces = { start: async () => {}, assertReviewable: async () => {}, acknowledge: async () => {},
    acquire: async () => ({ cwd, id: 'bg-original', capture: async () => undefined, release: async () => {} }) };
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      step: { id: 'build', name: 'Build', kind: 'ai', output: 'codechange', access: 'editworktree', provider: 'claude', model: 'sonnet', instructions: 'Build', automatic: false,
        nativeTools: { delegation: { maxConcurrent: 1 } } } } };
  const capture = vi.fn<typeof captureProcess>(async (_command, args, options) => {
    expect(options.cwd).not.toBe(cwd); expect(args[args.indexOf('--tools') + 1]).toBe('Agent,StructuredOutput');
    expect(args[args.indexOf('--agent') + 1]).toBe('coforge-coordinator');
    expect(JSON.parse(await readFile(args[args.indexOf('--agents') + 1]!, 'utf8'))['coforge-worker'].disallowedTools).toContain('Agent');
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { summary: 'Native worker completed' } });
  });
  const probe = vi.fn<typeof captureProcess>(async (_command, args) => args[0] === '--version' ? '2.1.281' : '--agents --agent --restricted --strict-mcp-config --permission-prompts --max-budget-usd');
  expect((await runBackgroundClaude(input, workspaces, files, capture, [], undefined, probe)).summary).toBe('Native worker completed');
  expect(probe).toHaveBeenCalledTimes(2); expect(capture).toHaveBeenCalledOnce();
});
