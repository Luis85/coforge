import { afterEach, expect, it } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { createSeed } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { MemoryStorage, nodeTimers } from './memory-storage';
import type { AgentTaskRequest } from '../../../features/coforge/application/agent-task';
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });
async function fixture() {
  const state = createSeed(); state.settings.paused = true;
  state.settings.workflow = { ...defaultWorkflowDefinition(state.settings), revision: 'nudge-definition', steps: [{ id: 'ask-reviewer', name: 'Ask reviewer', instructions: 'Review this request and list risks.', kind: 'nudge', teamId: 'team-one', agentId: 'reviewer' }] };
  const calls: AgentTaskRequest[] = []; let unknown = false;
  const studio = new StudioService(new MemoryStorage(state), { runners: { demo: async () => { throw new Error('No AI stage should run'); }, claude: async () => { throw new Error('No AI stage should run'); } },
    timers: nodeTimers(), probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }), agentTasks: { create: async input => { calls.push(input); if (unknown) throw new Error('Unknown delivery'); return { runId: `child-${calls.length}`, sourcePath: input.sourcePath }; } } });
  await studio.start(); cleanups.push(() => studio.stop());
  return { studio, calls, ideaId: studio.state().ideas.find(idea => idea.status === 'inbox')!.id, uncertain: (value: boolean) => { unknown = value; } };
}
it('dispatches a frozen agent task as an explicit local step without an AI job or fabricated increment', async () => {
  const f = await fixture(); const run = await f.studio.startWorkflow(f.ideaId);
  expect(f.calls).toHaveLength(1); expect(f.calls[0]).toMatchObject({ projectId: 'CFP-001', ideaId: f.ideaId, teamId: 'team-one', agentId: 'reviewer', prompt: 'Review this request and list risks.' });
  expect(run).toMatchObject({ state: 'finished', cursor: 1, attempts: [{ kind: 'nudge', status: 'succeeded', nudgeState: 'submitted', nudgeRunId: 'child-1' }] });
  expect(f.studio.state().jobs).toHaveLength(createSeed().jobs.length);
  expect(f.studio.state().ideas.find(idea => idea.id === f.ideaId)?.increment).toBeUndefined();
});
it('holds uncertain nudge outcomes and requires explicit recovery before a fresh task attempt', async () => {
  const f = await fixture(); f.uncertain(true); const run = await f.studio.startWorkflow(f.ideaId);
  expect(run.state).toBe('attention'); expect(f.calls).toHaveLength(1);
  await expect(f.studio.runWorkflowStep(f.ideaId)).rejects.toThrow('acknowledge');
  await f.studio.acknowledgeWorkflowNudge(f.ideaId, run.revision, true); f.uncertain(false); await f.studio.runWorkflowStep(f.ideaId);
  expect(f.calls).toHaveLength(2); expect(f.calls[0]?.attemptId).not.toBe(f.calls[1]?.attemptId);
  const latest = f.studio.state().ideas.find(idea => idea.id === f.ideaId)?.workflowRun;
  expect(latest?.attempts[0]).toMatchObject({ nudgeState: 'unknown', nudgeAcknowledgedAt: expect.any(String) });
  expect(latest?.attempts[1]).toMatchObject({ status: 'succeeded', nudgeRunId: 'child-2' });
});
