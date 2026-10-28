import { describe, expect, it } from 'vitest';
import { ExecutionKernel, type ExecutionKernelHost } from '../../../features/coforge/application/execution-kernel';
import { emptyExecutionJournal, type ExecutionJournal } from '../../../features/coforge/domain/execution-run';
import { projectExecutionContribution } from '../../../features/coforge/domain/execution-projection';

function fixture() {
  let journal: ExecutionJournal = emptyExecutionJournal(); let id = 0; const notes = new Map([['original', 'Original input'], ['replacement', 'Recovery note']]); let calls = 0;
  const host: ExecutionKernelHost = { journal: { load: async () => journal, save: async next => { journal = structuredClone(next); } },
    now: () => '2026-10-28T12:00:00.000Z', id: () => `attempt-${++id}`, assertEligible: async () => undefined,
    resolveInvocation: () => ({ prompt: 'Original input', inputArtifactIds: [] }), invoke: async () => { calls++; return { markdown: `Result ${calls}`, simulated: true }; },
    validateProjectionTarget: async (_run, sourceId) => { if (!notes.has(sourceId)) throw new Error('missing destination'); },
    publish: async (run, artifact) => { const sourceId = run.projectionTarget?.sourceId ?? run.subject.sourceId; const note = notes.get(sourceId); if (note === undefined) throw new Error('source deleted'); notes.set(sourceId, projectExecutionContribution(note, run, artifact)); },
  };
  const kernel = new ExecutionKernel(host);
  const admit = async () => { await kernel.load(); await kernel.admit({ id: 'run', submissionKey: 'original-generation-1', projectId: 'project', teamId: 'team', context: '',
    subject: { kind: 'note', sourceId: 'original', revision: 'r1', markdown: 'Original input' }, invocations: [{ id: 'review', roundId: 'review', agentId: 'agent', agentRevision: 'r1', provider: 'demo', model: 'sonnet', instructions: 'Analyze', access: 'none', inputRoundIds: [] }] }); };
  return { kernel, host, admit, notes, get journal() { return journal; }, get calls() { return calls; } };
}
describe('execution evidence recovery and retention', () => {
  it('exports an immutable full run and prunes only settled history while keeping the replay tombstone', async () => {
    const f = fixture(); await f.admit(); f.kernel.resume(); await f.kernel.step('run');
    const exported: unknown = JSON.parse(f.kernel.exportRun('run'));
    expect(exported).toMatchObject({ format: 'coforge-execution-export/v2', run: { subject: { markdown: 'Original input' }, artifacts: [{ markdown: 'Result 1' }] } });
    await f.kernel.pruneRun('run'); expect(f.journal.runs).toEqual([]); expect(f.journal.submissions).toEqual([{ key: 'original-generation-1', runId: 'run' }]);
    await expect(f.kernel.admit({ id: 'new-run', submissionKey: 'original-generation-1', projectId: 'project', teamId: 'team', context: '', subject: { kind: 'note', sourceId: 'original', revision: 'r1', markdown: 'Original input' }, invocations: [{ id: 'review', roundId: 'review', agentId: 'agent', agentRevision: 'r1', provider: 'demo', model: 'sonnet', instructions: 'Analyze', access: 'none', inputRoundIds: [] }] })).rejects.toThrow('tombstone');
  });
  it('cannot prune active or uncertain outcomes even after operator acknowledgement', async () => {
    const f = fixture(); await f.admit(); await expect(f.kernel.pruneRun('run')).rejects.toThrow('Retain'); f.host.invoke = async () => { throw new Error('unknown'); }; f.kernel.resume(); await expect(f.kernel.step('run')).rejects.toThrow('unknown');
    await f.kernel.cancel('run'); await expect(f.kernel.pruneRun('run')).rejects.toThrow('Retain'); expect(f.journal.runs).toHaveLength(1);
  });
  it('reassigns deleted-note publication without changing source evidence or repeating the provider', async () => {
    const f = fixture(); await f.admit(); f.notes.delete('original'); f.kernel.resume(); await expect(f.kernel.step('run')).rejects.toThrow('source deleted');
    expect(f.journal.runs[0]?.state).toBe('publishing'); await f.kernel.reassignProjection('run', 'replacement');
    expect(f.calls).toBe(1); expect(f.notes.has('original')).toBe(false); expect(f.notes.get('replacement')).toContain('Result 1');
    expect(f.notes.get('replacement')?.match(/Result 1/g)).toHaveLength(1); expect(f.journal.runs[0]?.subject.sourceId).toBe('original'); expect(f.journal.runs[0]?.projectionTarget?.sourceId).toBe('replacement'); expect(f.journal.runs[0]?.state).toBe('completed');
  });
  it('publishes historical settled artifacts to the replacement while preserving completion and rejects unknown destinations', async () => {
    const f = fixture(); await f.admit(); f.kernel.resume(); await f.kernel.step('run');
    await expect(f.kernel.reassignProjection('run', 'missing')).rejects.toThrow('missing');
    await f.kernel.reassignProjection('run', 'replacement'); expect(f.notes.get('replacement')).toContain('Result 1'); expect(f.journal.runs[0]?.state).toBe('completed'); expect(f.calls).toBe(1);
  });
});
