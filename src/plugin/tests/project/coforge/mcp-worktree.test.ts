// @vitest-environment happy-dom
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { LocalWorkflowWorkspaces } from '../../../infrastructure/coforge/workflow-workspaces';
import { McpStepFiles } from '../../../infrastructure/coforge/mcp-step-files';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import { McpWorkflowTools } from '../../../infrastructure/coforge/mcp-workflow-tools';
import { StudioService } from '../../../features/coforge/application/studio';
import { captureProcess } from '../../../infrastructure/coforge/process';
import { createSeed } from '../../../features/coforge/domain/seed';
import { record } from '../../../features/coforge/domain/check';
import type { WorkflowWorkspaceRecord } from '../../../features/coforge/application/workflow-workspace-ports';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('builds through real bounded file tools in a separate Git worktree and retains the host-captured diff', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'coforge-mcp-git-'));
  const git = (args: string[]) => captureProcess('git', args, { cwd: directory });
  let saved: WorkflowWorkspaceRecord[] = [];
  const workspaces = new LocalWorkflowWorkspaces({ load: async () => structuredClone(saved), save: async records => { saved = structuredClone(records); } });
  const timers = nodeTimers(); const runner = new McpStepRunner(workspaces, timers);
  const state = createSeed(); state.settings = { ...state.settings, paused: true, minVotes: 0 };
  const storage = new MemoryStorage(state);
  const studio = new StudioService(storage, { timers, runners: { demo: async () => { throw new Error('No model'); }, claude: async () => { throw new Error('No model'); }, mcp: input => runner.run(input) },
    probeRuntime: async () => ({ cliAvailable: false, projectPath: directory, allowImplementation: true }), assertWorkflowReviewable: (id, increment) => workspaces.assertReviewable(id, increment) });
  let worktreeFolder = '';
  try {
    await git(['init']); await writeFile(join(directory, 'game.ts'), 'export const lantern = false;\n');
    await git(['add', 'game.ts']); await git(['-c', 'user.name=CoForge Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Fixture']);
    await workspaces.start(); await studio.start();
    worktreeFolder = join(directory, 'worktrees');
    // Ignore the separately created worktree folder; the fixture's tracked repository remains clean.
    await writeFile(join(directory, '.git', 'info', 'exclude'), '/worktrees/\n');
    await studio.updateProject({ projectPath: directory, worktreeFolder, allowImplementation: true });
    const tools = new McpWorkflowTools(studio, runner, new McpStepFiles());
    const ideaId = studio.state().ideas.find(idea => idea.status === 'inbox')!.id;
    const projectId = studio.state().activeProjectId!;
    let readOnlySteps = 0;
    for (const output of [
      { verdict: 'clear', reason: 'A game feature', signals: [] },
      { reach: 10, impact: 1, confidence: 1, effort: 1, rationale: 'Small' },
      { summary: 'Add lantern', steps: ['Enable lantern'], acceptanceCriteria: ['Lantern is enabled'], risks: [] },
      { markdown: '# Lantern specification\n\nEnable the existing lantern without changing the save format.' },
      { summary: 'Enabled lantern' },
    ]) {
      const started = record(await tools.call(projectId, 'coforge_begin_step', { ideaId }));
      const taskId = String(started.jobId);
      await expect.poll(() => studio.state().jobs.find(job => job.id === taskId)?.error ?? runner.tasks(projectId).some(task => task.taskId === taskId), { timeout: 10000 }).toBe(true);
      const context = record(await tools.call(projectId, 'coforge_step_context', { taskId }));
      if (context.access === 'readproject') {
        readOnlySteps++;
        expect(await tools.call(projectId, 'coforge_read_file', { taskId, path: 'game.ts' })).toMatchObject({ content: 'export const lantern = false;\n' });
        await expect(tools.call(projectId, 'coforge_write_file', { taskId, path: 'game.ts', content: 'unsafe', expectedContent: null })).rejects.toThrow();
      }
      if (context.access === 'editworktree') {
        await tools.call(projectId, 'coforge_write_file', { taskId, path: 'game.ts', content: 'export const lantern = true;\n', expectedContent: 'export const lantern = false;\n' });
      }
      await tools.call(projectId, 'coforge_submit_result', { taskId, output });
    }
    const idea = studio.state().ideas.find(idea => idea.id === ideaId)!;
    expect(readOnlySteps).toBe(2);
    expect(idea).toMatchObject({ status: 'review', increment: { simulated: false, files: [{ path: 'game.ts', additions: 1, deletions: 1 }] } });
    expect(idea.increment?.diff).toContain('+export const lantern = true;');
    expect(await readFile(join(directory, 'game.ts'), 'utf8')).toBe('export const lantern = false;\n');
    expect(await readFile(join(idea.increment!.worktree!, 'game.ts'), 'utf8')).toBe('export const lantern = true;\n');
    await studio.act(ideaId, 'approve'); expect(studio.state().ideas.find(idea => idea.id === ideaId)?.status).toBe('shipped');
  } finally { await runner.dispose(); await studio.stop(); await rm(directory, { recursive: true, force: true }); }
}, 30000);
