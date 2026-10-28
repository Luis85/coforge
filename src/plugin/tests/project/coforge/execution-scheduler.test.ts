import { describe, expect, it } from 'vitest';
import { ExecutionScheduler } from '../../../features/coforge/application/execution-scheduler';
import { ExecutionKernel, type ExecutionKernelHost } from '../../../features/coforge/application/execution-kernel';
import { emptyExecutionJournal } from '../../../features/coforge/domain/execution-run';

function fixture() {
  let journal = emptyExecutionJournal(); const calls: string[] = []; let id = 0;
  const host: ExecutionKernelHost = {
    journal: { load: async () => journal, save: async value => { journal = structuredClone(value); } },
    now: () => '2026-10-28T12:00:00.000Z', id: () => `attempt-${++id}`, assertEligible: async () => undefined,
    resolveInvocation: () => ({ prompt: 'source', inputArtifactIds: [] }),
    invoke: async run => { calls.push(run.id); return { markdown: 'result', simulated: true }; }, publish: async () => undefined,
  };
  return { kernel: new ExecutionKernel(host), host, calls };
}
describe('shared action scheduler', () => {
  it('rotates between ready runs at invocation boundaries and skips project/run pauses', async () => {
    const f = fixture(); await f.kernel.load();
    for (const id of ['a', 'b', 'c']) await f.kernel.admit({ id, submissionKey: id, projectId: id, teamId: 'team', context: '',
      subject: { kind: 'note', sourceId: id, revision: 'r1', markdown: 'source' }, invocations: ['one', 'two'].map(step => ({ id: step, roundId: step, agentId: 'agent', agentRevision: 'r1', provider: 'demo', model: 'demo', instructions: 'Analyze', access: 'none', inputRoundIds: [] })) });
    const scheduler = new ExecutionScheduler(f.kernel, { projectEnabled: id => id !== 'c', providerAvailable: () => true });
    f.kernel.resume(); await scheduler.tick(); await scheduler.tick(); await scheduler.tick();
    expect(f.calls).toEqual(['a', 'b', 'a']); await f.kernel.pauseRun('b', true); expect(await scheduler.tick()).toBeNull();
    await f.kernel.pauseRun('b', false); await scheduler.tick(); expect(f.calls).toEqual(['a', 'b', 'a', 'b']);
  });
  it('does not compete with a legacy invocation and does not dispatch after disposal', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit({ id: 'a', submissionKey: 'a', projectId: 'p', teamId: 't', context: '', subject: { kind: 'note', sourceId: 's', revision: 'r', markdown: 'source' },
      invocations: [{ id: 'one', roundId: 'r', agentId: 'agent', agentRevision: 'r', provider: 'demo', model: 'demo', instructions: 'Analyze', access: 'none', inputRoundIds: [] }] });
    const scheduler = new ExecutionScheduler(f.kernel, { projectEnabled: () => true, providerAvailable: () => false }); f.kernel.resume();
    expect(await scheduler.tick()).toBeNull(); expect(f.calls).toEqual([]); scheduler.dispose(); expect(await scheduler.tick()).toBeNull(); expect(f.kernel.isPaused).toBe(true);
  });
});
