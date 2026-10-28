import { describe, expect, it } from 'vitest';
import { ExecutionKernel, type ExecutionKernelHost } from '../../../features/coforge/application/execution-kernel';
import { emptyExecutionJournal, type ExecutionJournal } from '../../../features/coforge/domain/execution-run';
import { projectExecutionContribution } from '../../../features/coforge/domain/execution-projection';
import { ExecutionBlockError } from '../../../features/coforge/domain/execution-block';

const invocation = (id: string) => ({ id, roundId: 'opinions', agentId: id, agentRevision: 'r1', provider: 'demo' as const, model: 'demo', instructions: 'Analyze', access: 'none' as const, inputRoundIds: [] });
const admission = () => ({ id: 'run-1', submissionKey: '["inbox","source",1]', subject: { kind: 'note' as const, sourceId: 'source', revision: 'source-r1', markdown: 'Human input' }, projectId: 'project', teamId: 'team', context: 'Frozen context', invocations: [invocation('a'), invocation('b')] });
function fixture() {
  let saved: ExecutionJournal = emptyExecutionJournal(); let calls = 0; let writes = 0; let failWrite = false; let failSaveAt = 0; let saves = 0; let note = 'Human input';
  const host: ExecutionKernelHost = {
    journal: { load: async () => structuredClone(saved), save: async next => { saves++; if (saves === failSaveAt) throw new Error('disk'); saved = structuredClone(next); } },
    now: () => '2026-10-28T12:00:00.000Z', id: () => `attempt-${calls + 1}-${saves}`,
    assertEligible: async () => undefined,
    resolveInvocation: (run, item) => ({ prompt: `${run.subject.markdown}\n${item.instructions}`, inputArtifactIds: [] }),
    invoke: async () => { calls++; return { markdown: `Answer ${calls}`, simulated: true }; },
    publish: async (run, artifact) => { writes++; if (failWrite) throw new Error('note locked'); note = projectExecutionContribution(note, run, artifact); },
  };
  return { kernel: new ExecutionKernel(host), host, get saved() { return saved; }, get calls() { return calls; }, get writes() { return writes; }, get note() { return note; }, failWrite: (value: boolean) => { failWrite = value; }, failSaveAt: (value: number) => { failSaveAt = value; } };
}
describe('durable execution kernel', () => {
  it('admits one generation, starts paused and persists dispatch intent before invoking', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); await f.kernel.admit(admission());
    expect(f.saved.runs).toHaveLength(1); await expect(f.kernel.step('run-1')).rejects.toThrow('paused'); expect(f.calls).toBe(0);
    f.kernel.resume(); f.failSaveAt(2); await expect(f.kernel.step('run-1')).rejects.toThrow('disk'); expect(f.calls).toBe(0);
  });
  it('retains results on projection failure and repairs without another invocation', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.kernel.resume(); f.failWrite(true);
    await expect(f.kernel.step('run-1')).rejects.toThrow('note locked'); expect(f.calls).toBe(1); expect(f.saved.runs[0]?.cursor).toBe(0); expect(f.saved.runs[0]?.state).toBe('publishing');
    f.failWrite(false); await f.kernel.repair('run-1'); expect(f.calls).toBe(1); expect(f.saved.runs[0]?.cursor).toBe(1); expect(f.note).toContain('Answer 1');
    await f.kernel.step('run-1'); expect(f.calls).toBe(2); expect(f.saved.runs[0]?.state).toBe('completed');
  });
  it('recognizes an already projected result after a crash before acknowledgement', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.kernel.resume(); f.failSaveAt(4);
    await expect(f.kernel.step('run-1')).rejects.toThrow('disk'); expect(f.note).toContain('Answer 1');
    const recovered = new ExecutionKernel(f.host); await recovered.load(); await recovered.repair('run-1');
    expect(f.note.match(/Answer 1/g)).toHaveLength(1); expect(f.calls).toBe(1); expect(f.saved.runs[0]?.cursor).toBe(1);
  });
  it('records uncertainty after an external result could not be persisted and never replays it on recovery', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.kernel.resume(); f.failSaveAt(3);
    await expect(f.kernel.step('run-1')).rejects.toThrow('disk'); expect(f.calls).toBe(1);
    const recovered = new ExecutionKernel(f.host); await recovered.load(); recovered.resume();
    expect(f.saved.runs[0]?.state).toBe('attention'); expect(f.saved.runs[0]?.attempts[0]?.status).toBe('unknown');
    await expect(recovered.step('run-1')).rejects.toThrow('attention'); expect(f.calls).toBe(1);
  });
  it('blocks a revoked capability before dispatch and preserves immutable invocation inputs', async () => {
    const f = fixture(); f.host.assertEligible = async () => { throw new Error('revoked'); }; await f.kernel.load(); const input = admission(); await f.kernel.admit(input); input.invocations[0]!.instructions = 'Changed'; f.kernel.resume();
    await expect(f.kernel.step('run-1')).rejects.toThrow('revoked'); expect(f.calls).toBe(0); expect(f.saved.runs[0]?.invocations[0]?.instructions).toBe('Analyze');
    expect(f.saved.runs[0]?.state).toBe('attention'); expect(f.saved.runs[0]?.reason).toContain('preflight');
    await expect(f.kernel.step('run-1')).rejects.toThrow('attention'); expect(f.saved.runs[0]?.attempts).toEqual([]);
  });
  it('preserves edited human content and reports edited managed blocks as conflicts', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.kernel.resume(); await f.kernel.step('run-1');
    const run = f.saved.runs[0]!; const artifact = run.artifacts[0]!;
    expect(projectExecutionContribution(`Human edit\n${f.note}`, run, artifact)).toContain('Human edit');
    expect(() => projectExecutionContribution(f.note.replace('Answer 1', 'Human correction'), run, artifact)).toThrow('conflict');
  });
  it('rejects oversized source before admission and retains no tombstone', async () => {
    const f = fixture(); await f.kernel.load(); const input = admission(); input.subject.markdown = 'x'.repeat(160001);
    await expect(f.kernel.admit(input)).rejects.toThrow(); expect(f.saved.submissions).toEqual([]);
  });
  it('persists a human checkpoint without a provider call, rejects stale acknowledgement and resumes explicitly', async () => {
    const f = fixture(); await f.kernel.load();
    await f.kernel.admit({ ...admission(), checkpoints: [{ id: 'review', name: 'Review analysis', instructions: 'Select a direction', beforeCursor: 0, kind: 'checklist', items: [{ id: 'read', label: 'Read every proposal', required: true }] }] });
    f.kernel.resume(); await f.kernel.step('run-1'); expect(f.calls).toBe(0); expect(f.saved.runs[0]?.state).toBe('waiting-human');
    await expect(f.kernel.acknowledgeCheckpoint('run-1', 'stale', ['read'])).rejects.toThrow('changed');
    await expect(f.kernel.acknowledgeCheckpoint('run-1', 'review', [])).rejects.toThrow('required');
    await f.kernel.acknowledgeCheckpoint('run-1', 'review', ['read'], 'Use proposal A'); await f.kernel.step('run-1');
    expect(f.calls).toBe(1); expect(f.saved.runs[0]?.checkpointEvidence?.[0]?.note).toBe('Use proposal A');
  });
  it('retains host telemetry when the provider fails after reporting cost and tokens', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission());
    f.host.invoke = async (run, _invocation, attempt) => {
      await f.kernel.recordTelemetry(run.id, attempt.id, { inputTokens: 100, outputTokens: 25 }, 0.2); throw new Error('provider disconnected');
    };
    f.kernel.resume(); await expect(f.kernel.step('run-1')).rejects.toThrow('provider disconnected');
    expect(f.saved.runs[0]?.attempts[0]).toMatchObject({ status: 'unknown', costUsd: 0.2, usageSource: 'provider', usage: { inputTokens: 100, outputTokens: 25 } });
    expect(f.saved.runs[0]?.artifacts).toEqual([]);
  });
  it('records a permitted missing contribution with a publication barrier and preserves acknowledged uncertainty', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.host.invoke = async () => { throw new Error('failed member'); };
    f.kernel.resume(); await expect(f.kernel.step('run-1')).rejects.toThrow('failed member');
    await expect(f.kernel.skipInvocation('run-1', 'Unreachable member', true)).rejects.toThrow('completion policy');
    f.host.canSkip = () => true;
    await expect(f.kernel.skipInvocation('run-1', 'Unreachable member')).rejects.toThrow('acknowledge');
    await f.kernel.skipInvocation('run-1', 'Unreachable member', true);
    expect(f.saved.runs[0]?.cursor).toBe(1); expect(f.saved.runs[0]?.hasGaps).toBe(true);
    expect(f.saved.runs[0]?.artifacts[0]).toMatchObject({ skipped: true, skipReason: 'Unreachable member' });
    expect(f.saved.runs[0]?.attempts[0]).toMatchObject({ status: 'unknown', uncertaintyAcknowledgedAt: '2026-10-28T12:00:00.000Z' });
    expect(f.note).toContain('missing contribution'); expect(f.saved.runs[0]?.attempts[1]?.skipped).toBe(true);
  });
  it('explicitly acknowledges a newer source while retaining the captured source and instructions', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.host.assertEligible = async () => { throw new Error('source changed'); };
    f.kernel.resume(); await expect(f.kernel.step('run-1')).rejects.toThrow('source changed'); await f.kernel.continueSnapshot('run-1', 'new-source-revision');
    expect(f.saved.runs[0]?.sourceAcknowledgement).toEqual({ revision: 'new-source-revision', acknowledgedAt: '2026-10-28T12:00:00.000Z' });
    expect(f.saved.runs[0]?.subject.markdown).toBe('Human input'); expect(f.saved.runs[0]?.subject.revision).toBe('source-r1'); expect(f.saved.runs[0]?.state).toBe('queued');
  });
  it('reserves actual UTF-8 evidence capacity after adding the captured dispatch prompt before calling a provider', async () => {
    const f = fixture(); await f.kernel.load(); const input = { ...admission(), definitionSnapshot: '界'.repeat(150000), context: '界'.repeat(160000) }; input.subject.markdown = '界'.repeat(160000);
    await f.kernel.admit(input); f.host.resolveInvocation = () => ({ prompt: '界'.repeat(160000), inputArtifactIds: [] }); f.kernel.resume();
    await expect(f.kernel.step('run-1')).rejects.toThrow('reserved result capacity'); expect(f.calls).toBe(0); expect(f.saved.runs[0]?.attempts).toEqual([]);
  });
  it('charges retries against the captured finite invocation allowance before another external call', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit({ ...admission(), limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, maxInvocations: 2, simulation: true } });
    let attempted = 0; f.host.invoke = async () => { attempted++; throw new Error('unknown'); }; f.kernel.resume(); await expect(f.kernel.step('run-1')).rejects.toThrow('unknown');
    await f.kernel.retry('run-1', true); await expect(f.kernel.step('run-1')).rejects.toThrow('invocation allowance'); expect(attempted).toBe(1); expect(f.saved.runs[0]?.state).toBe('attention');
  });
  it('exposes trusted recovery instructions and never promotes arbitrary port errors into private status', async () => {
    const f = fixture(); await f.kernel.load(); await f.kernel.admit(admission()); f.kernel.resume(); f.host.assertEligible = async () => { throw new ExecutionBlockError('source-changed'); };
    await expect(f.kernel.step('run-1')).rejects.toThrow('source changed'); expect(f.saved.runs[0]?.reason).toContain('continue that snapshot');
    await f.kernel.retry('run-1'); f.host.assertEligible = async () => { throw new Error('C:/private/secret-note.md includes a secret'); };
    await expect(f.kernel.step('run-1')).rejects.toThrow('secret-note'); expect(f.saved.runs[0]?.reason).not.toContain('secret'); expect(f.saved.runs[0]?.reason).toContain('preflight');
  });
});
