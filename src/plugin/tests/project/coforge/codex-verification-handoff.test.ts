import { beforeEach, expect, it, vi } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { Increment } from '../../../features/coforge/domain/types';
import type { WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { CodexTransportInput } from '../../../infrastructure/coforge/codex-transport';
const mocks = vi.hoisted(() => ({ transport: vi.fn(), records: vi.fn(), captureVerification: vi.fn(), dispose: vi.fn(), order: [] as string[] }));
vi.mock('../../../infrastructure/coforge/codex-transport', () => ({ runCodexTransport: mocks.transport }));
vi.mock('../../../infrastructure/coforge/codex-workflow-tools', () => ({ codexWorkflowTools: async () => ({ url: 'http://127.0.0.1/synthetic', token: 'synthetic',
  dispose: mocks.dispose, assertBudget: () => {}, verificationRecords: mocks.records, captureVerification: mocks.captureVerification }) }));
import { runCodexStage } from '../../../infrastructure/coforge/codex-runner';

const record: WorkflowVerificationRecord = { id: 'verification', runId: 'run', attemptId: 'attempt', projectId: 'CFP-001', commandId: 'tests', label: 'Product tests', executable: 'node', args: ['tests.js'],
  runtime: 'docker', imageId: 'sha256:' + 'a'.repeat(64), sourceHash: 'b'.repeat(64), startedAt: '2026-11-01T00:00:00.000Z', finishedAt: '2026-11-01T00:00:01.000Z', status: 'completed', exitCode: 0, output: '1 passed', truncated: false };
beforeEach(() => {
  mocks.order.length = 0; mocks.transport.mockReset(); mocks.records.mockReset(); mocks.captureVerification.mockReset(); mocks.dispose.mockReset();
  mocks.records.mockReturnValue([record]);
  mocks.dispose.mockImplementation(async () => { mocks.order.push('drained'); });
  mocks.captureVerification.mockImplementation(async (increment: Increment) => { mocks.order.push('verification-bound'); return { ...increment, verification: [record], verificationSourceHash: record.sourceHash }; });
});
function fixture(readOnly = false, changes = true) {
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: { ...defaultSettings(), provider: 'codex', model: 'gpt-6.1-sol' }, integration: defaultIntegration(),
    onNativeProcess: async () => {},
    onNativeRuntime: async () => {},
    onChanges: vi.fn(async () => { mocks.order.push('published'); }),
    workflow: { runId: 'run', definitionRevision: 'revision', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [],
      verificationProfile: { enabled: true, dockerBin: 'docker', imageId: record.imageId, commands: [{ id: 'tests', label: 'Product tests', executable: 'node', args: ['tests.js'] }], timeoutSeconds: 30, maxRuns: 2 },
      step: { id: 'build', name: 'Build', kind: 'ai', instructions: 'Build', provider: 'codex', model: 'gpt-6.1-sol', automatic: false, output: readOnly ? 'markdown' : 'codechange', access: readOnly ? 'readproject' : 'editworktree', nativeTools: { verification: { commandIds: ['tests'] } } } } };
  const increment: Increment = { summary: 'Captured changes', files: [{ path: 'game.ts', additions: 1, deletions: 0 }], diff: '+changed', simulated: false, tests: [], createdAt: record.finishedAt! };
  const capture = vi.fn(async () => { mocks.order.push('captured'); return changes ? increment : undefined; });
  const lease = { id: 'workspace', cwd: '/synthetic/native-tests', ...(readOnly ? { readOnly: true as const } : {}), capture, release: vi.fn(async () => {}) };
  mocks.transport.mockResolvedValue({ output: readOnly ? { markdown: '# Review' } : { summary: 'Root result' } });
  return { input, capture, lease, workspaces: { start: async () => {}, acquire: async () => lease, acknowledge: async () => {}, assertReviewable: async () => {} } };
}

it('binds host verification to the final captured increment after broker drain and before publishing changes', async () => {
  const f = fixture();
  const result = await runCodexStage(f.input, f.workspaces);
  expect(result.verification).toEqual([record]);
  expect(result.increment).toMatchObject({ verification: [record], verificationSourceHash: record.sourceHash });
  expect(f.input.onChanges).toHaveBeenCalledWith(expect.objectContaining({ verification: [record] }));
  expect(mocks.order.slice(0, 4)).toEqual(['drained', 'captured', 'verification-bound', 'published']);
  expect(mocks.transport).toHaveBeenCalledWith(expect.objectContaining({ nativeTools: f.input.workflow!.step.nativeTools }));
});

it('retains actual verification records even when the provider produces no code diff', async () => {
  const f = fixture(false, false);
  const result = await runCodexStage(f.input, f.workspaces);
  expect(result.verification).toEqual([record]); expect(result.increment).toBeUndefined();
  expect(mocks.captureVerification).not.toHaveBeenCalled(); expect(f.input.onChanges).toHaveBeenCalledWith(null);
});

it('retains read-only verification outcomes without recapturing or replacing the inherited Build', async () => {
  const f = fixture(true);
  const result = await runCodexStage(f.input, f.workspaces);
  expect(result.verification).toEqual([record]); expect(result.markdown).toBe('# Review'); expect(result.increment).toBeUndefined();
  expect(f.capture).not.toHaveBeenCalled(); expect(mocks.captureVerification).not.toHaveBeenCalled(); expect(f.input.onChanges).not.toHaveBeenCalled();
});

it('refuses native foreground admission without durable original-process evidence before provider startup', async () => {
  const f = fixture(); delete f.input.onNativeProcess;
  await expect(runCodexStage(f.input, f.workspaces)).rejects.toThrow('durable foreground process ownership');
  expect(mocks.transport).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
});

it('refuses a delegated background attempt without its captured finite elapsed deadline', async () => {
  const f = fixture();
  f.input.workflow!.step.nativeTools = { delegation: { maxConcurrent: 1 } };
  f.input.workflow!.step.execution = { mode: 'background', idleWarningSeconds: 1800 };
  await expect(runCodexStage(f.input, f.workspaces)).rejects.toThrow('explicit elapsed deadline');
  expect(mocks.transport).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
});

it('always quarantines and releases the lease while retaining private auth when broker cleanup cannot prove ownership', async () => {
  const f = fixture(); const phases: string[] = []; let retained: string | undefined;
  f.input.onNativeProcess = async event => { phases.push(event.phase); };
  mocks.dispose.mockRejectedValue(new Error('Original verification ownership unknown'));
  mocks.transport.mockImplementation(async (options: CodexTransportInput) => {
    retained = options.directory;
    await mkdir(join(retained, 'codex-home')); await writeFile(join(retained, 'codex-home', 'auth.json'), 'OPAQUE_FAKE_AUTH');
    await options.onOwnedProcess?.({ pid: 123, platform: process.platform, birth: 'fixture', image: 'a'.repeat(64) }, 'launched');
    return { output: { summary: 'Root finished' } };
  });
  try {
    await expect(runCodexStage(f.input, f.workspaces)).rejects.toThrow('ownership unknown');
    expect(f.lease.release).toHaveBeenCalledWith(true);
    expect(phases).toContain('launched'); expect(phases).toContain('unknown'); expect(phases).not.toContain('terminated');
    expect(await readFile(join(retained!, 'codex-home', 'auth.json'), 'utf8')).toBe('OPAQUE_FAKE_AUTH');
  } finally { if (retained) await rm(retained, { recursive: true, force: true }); }
});
