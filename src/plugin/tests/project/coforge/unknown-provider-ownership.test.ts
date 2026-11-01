import { expect, it, vi } from 'vitest';
import { seededStore } from './memory-storage';
import { PROVIDER_FAILURE_CODES, providerFailureFor, safeFailureHasUnknownOwnership } from '../../../features/coforge/domain/provider-failure';
import { assertVerificationSettled } from '../../../features/coforge/application/verification-admission';
import { recoverForegroundVerification } from '../../../infrastructure/coforge/verification/foreground-recovery';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { ai, fixture } from './configured-workflow-fixture';

async function retained(uncertain = true) {
  const f = await seededStore(); const ideaId = f.store.snapshot().ideas[0]!.id;
  await f.store.transaction(state => {
    state.jobs.push({ id: 'original-unattributed', ideaId, projectId: 'CFP-001', stage: 'plan', provider: 'claude', status: 'failed', logs: [],
      failure: providerFailureFor('incomplete_output', uncertain), startedAt: new Date().toISOString() });
  });
  return { ...f, ideaId };
}

it.each(['failed', 'cancelled'] as const)('blocks another paid attempt when a %s provider has no retained identity and cessation is unverified', async status => {
  const f = await retained(); await f.store.transaction(state => { state.jobs[0]!.status = status; });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).toThrow(/original.*execution|ownership|unverified/i);
  const reopened = new StudioStore(f.storage); await reopened.init();
  expect(() => assertVerificationSettled(reopened.snapshot(), f.ideaId)).toThrow();
  expect(f.store.snapshot().workflowStopHolds ?? []).not.toContain(f.ideaId);
});

it('recognizes only validated catalogue uncertainty across every retained failure cause', () => {
  expect(safeFailureHasUnknownOwnership(undefined)).toBe(false);
  for (const code of PROVIDER_FAILURE_CODES) {
    expect(safeFailureHasUnknownOwnership(providerFailureFor(code))).toBe(code === 'ownership_unknown');
    expect(safeFailureHasUnknownOwnership(providerFailureFor(code, true))).toBe(true);
  }
  expect(() => safeFailureHasUnknownOwnership({ ...providerFailureFor('incomplete_output'), nextStep: 'Original ownership is unknown' })).toThrow();
});

it('holds a direct ownership_unknown cause independently of another known provider failure', async () => {
  const f = await retained(); await f.store.transaction(state => { state.jobs[0]!.failure = providerFailureFor('ownership_unknown'); });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).toThrow();
});

it('allows ordinary incomplete output and does not block another request', async () => {
  const f = await retained(false);
  expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).not.toThrow();
  await f.store.transaction(state => { state.jobs[0]!.failure = providerFailureFor('incomplete_output', true); });
  expect(() => assertVerificationSettled(f.store.snapshot(), 'another-request')).not.toThrow();
});

it('retains actual original process acknowledgement as authority without erasing the recorded failure', async () => {
  const f = await retained(); await f.store.transaction(state => {
    state.jobs[0]!.nativeProcess = { runId: 'original-run', attemptId: 'original-attempt', projectId: 'CFP-001',
      identity: { pid: 123, platform: 'linux', groupId: 123, birth: 'original', image: 'a'.repeat(64) },
      phase: 'unknown', observedAt: new Date().toISOString(), operatorAcknowledgedAt: new Date().toISOString() };
  });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).not.toThrow();
  expect(f.store.snapshot().jobs[0]!.failure).toEqual(providerFailureFor('incomplete_output', true));
});

it('leaves worker-backed recovery under its existing durable authority', async () => {
  const f = await retained(); await f.store.transaction(state => {
    state.jobs[0]!.durable = { intent: 'cancel', policy: { mode: 'background' },
      ref: { version: 1, executionId: 'original', workerId: 'original-worker', epoch: 1, inputHash: 'c'.repeat(64) } };
  });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).not.toThrow();
});

it('preserves external MCP workspace recovery authority rather than inventing a native identity requirement', async () => {
  const f = await retained(); await f.store.transaction(state => { state.jobs[0]!.provider = 'mcp'; });
  expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).not.toThrow();
});

it('rejects a fresh workflow start before dispatch when an earlier identity-free attempt is still unknown', async () => {
  const f = await fixture([ai('refine', 'markdown', 'none')]);
  try {
    await f.store.transaction(state => {
      state.jobs.push({ id: 'original-unattributed', ideaId: f.idea.id, projectId: 'CFP-001', stage: 'plan', provider: 'claude',
        status: 'failed', logs: [], failure: providerFailureFor('incomplete_output', true), startedAt: new Date().toISOString() });
    });
    await expect(f.engine.startWorkflow(f.idea.id)).rejects.toThrow(/Original execution ownership remains unverified/);
    expect(f.runner).not.toHaveBeenCalled(); expect(f.store.snapshot().jobs).toHaveLength(1);
  } finally { await f.engine.stop(); }
});

it.each([true, false])('retains an uncertain unattributed Codex runtime and cleans only proven prelaunch preparation (uncertain: %s)', async uncertain => {
  const f = await retained(uncertain);
  const runtime = { directory: '/private/original', ownerToken: 'b'.repeat(64), runId: 'run', attemptId: 'attempt', projectId: 'CFP-001' };
  await f.store.transaction(state => { state.jobs[0]!.provider = 'codex'; state.jobs[0]!.nativeRuntime = runtime; });
  const purge = vi.fn(async () => {}), provider = vi.fn(async () => 'terminal' as const);
  await recoverForegroundVerification(f.store, undefined, provider, undefined, purge);
  expect(provider).not.toHaveBeenCalled();
  if (uncertain) {
    expect(purge).not.toHaveBeenCalled(); expect(f.store.snapshot().jobs[0]!.nativeRuntime).toEqual(runtime);
    expect(() => assertVerificationSettled(f.store.snapshot(), f.ideaId)).toThrow();
  } else {
    expect(purge).toHaveBeenCalledExactlyOnceWith(runtime); expect(f.store.snapshot().jobs[0]!.nativeRuntime).toBeUndefined();
  }
});
