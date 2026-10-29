import { afterEach, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition, workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { recoverConfiguredRuns } from '../../../features/coforge/domain/configured-workflow-run';
import { MemoryStorage, nodeTimers } from './memory-storage';
import type { AgentTaskRequest } from '../../../features/coforge/application/agent-task';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

async function fixture() {
  const state = createSeed(); state.settings.paused = true;
  state.settings.workflow = workflowDefinitionCheck({ ...defaultWorkflowDefinition(state.settings), revision: 'council-test', steps: [
    { id: 'ask', kind: 'council', name: 'Ask Council', instructions: 'Compare the options.', councilId: 'advice', automatic: false, inputs: [] },
    { id: 'review', kind: 'ai', name: 'Use advice', instructions: 'Use the Council answer.', output: 'markdown', access: 'none', provider: 'demo', model: 'sonnet', automatic: false, inputs: ['markdown'] },
  ] });
  const calls: AgentTaskRequest[] = [];
  const cancelled: string[] = [];
  let result: import('../../../features/coforge/application/agent-task').AgentTaskResult = { state: 'pending' };
  let uncertain = false;
  const studio = new StudioService(new MemoryStorage(state), { timers: nodeTimers(), probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }),
    runners: { demo: async input => { expect(input.workflow?.inputArtifacts[0]?.markdown).toContain('Architect'); return { markdown: 'Advice used.' }; }, claude: async () => ({ markdown: '' }) },
    agentTasks: { create: async input => { calls.push(input); if (uncertain) throw new Error('unknown'); return { runId: 'child-council', sourcePath: input.sourcePath }; }, result: async () => result, cancel: async id => { cancelled.push(id); } },
  });
  await studio.start(); cleanups.push(() => studio.stop());
  return { studio, calls, cancelled, id: studio.state().ideas.find(idea => idea.status === 'inbox')!.id, setResult: (value: typeof result) => { result = value; }, uncertain: () => { uncertain = true; } };
}

it('waits for published Council answers and binds attributed Markdown to the next step', async () => {
  const f = await fixture(); const run = await f.studio.startWorkflow(f.id);
  expect(run).toMatchObject({ state: 'running', cursor: 0, attempts: [{ kind: 'council', nudgeRunId: 'child-council', status: 'running' }] });
  expect(f.calls[0]).toMatchObject({ councilId: 'advice', prompt: 'Compare the options.' });
  await f.studio.runWorkflowStep(f.id);
  expect(f.calls).toHaveLength(1);
  f.setResult({ state: 'completed', markdown: '## Architect · Solutions\nBuild a small playable loop.', projectId: 'CFP-001', sourcePath: f.calls[0]!.sourcePath });
  const ready = await f.studio.runWorkflowStep(f.id);
  expect(ready.cursor).toBe(1);
  expect(ready.artifacts[0]).toMatchObject({ stepId: 'ask', output: 'markdown', markdown: expect.stringContaining('Architect') });
  expect(f.calls).toHaveLength(1);
  await f.studio.runWorkflowStep(f.id);
  await vi.waitFor(() => expect(f.studio.state().ideas.find(item => item.id === f.id)?.workflowRun?.state).toBe('finished'));
});

it('retains a confirmed child across reload and holds uncertain admissions without replay', async () => {
  const f = await fixture(); const run = await f.studio.startWorkflow(f.id);
  const state = createSeed(); state.ideas[0]!.workflowRun = structuredClone(run);
  recoverConfiguredRuns(state);
  expect(state.ideas[0]!.workflowRun).toMatchObject({ state: 'running', activeAttemptId: run.activeAttemptId });
  const other = await fixture(); other.uncertain(); const unknown = await other.studio.startWorkflow(other.id);
  expect(unknown.state).toBe('attention');
  await expect(other.studio.runWorkflowStep(other.id)).rejects.toThrow('acknowledge');
  expect(other.calls).toHaveLength(1);
});

it.each(['attention', 'cancelled', 'missing', 'stale', 'oversized'] as const)('holds %s child results without advancing or replaying', async kind => {
  const f = await fixture(); await f.studio.startWorkflow(f.id);
  f.setResult(kind === 'stale' || kind === 'oversized' ? { state: 'completed', markdown: kind === 'oversized' ? 'a'.repeat(16001) : 'Other project answer', projectId: kind === 'stale' ? 'different' : 'CFP-001', sourcePath: f.calls[0]!.sourcePath } : { state: kind });
  const run = await f.studio.runWorkflowStep(f.id);
  expect(run).toMatchObject({ state: 'attention', cursor: 0, artifacts: [] });
  expect(f.calls).toHaveLength(1);
  const unchanged = await f.studio.runWorkflowStep(f.id);
  expect(unchanged.revision).toBe(run.revision);
});

it('cancels the original child when its workflow is stopped and ignores later answers', async () => {
  const f = await fixture(); await f.studio.startWorkflow(f.id);
  await f.studio.stopWorkflow(f.id);
  expect(f.cancelled).toEqual(['child-council']);
  await expect(f.studio.runWorkflowStep(f.id)).rejects.toThrow('current state');
  expect(f.calls).toHaveLength(1);
});
