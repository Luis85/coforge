import { expect, it } from 'vitest';
import { workflowIncrementCheck, workflowArtifactCheck, workflowArtifactHash } from '../../../features/coforge/domain/configured-workflow-run';
import { durableBuildResultCheck } from '../../../features/coforge/domain/durable-build';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { validateExecutionOutput } from '../../../features/coforge/application/workflow-execution';
import { createSeed } from '../../../features/coforge/domain/seed';
import { toLoaded } from './memory-storage';
import { increment } from './configured-workflow-fixture';
import { backgroundBuildRetryInspectionCheck } from '../../../features/coforge/domain/background-build-retry';

it('preserves an optional host snapshot hash through native results, managed artifacts and persisted increments', () => {
  const captured = { ...increment, simulated: false, snapshotHash: 'a'.repeat(64) };
  expect(workflowIncrementCheck(captured).snapshotHash).toBe(captured.snapshotHash);
  expect(durableBuildResultCheck({ increment: captured }).increment?.snapshotHash).toBe(captured.snapshotHash);
  const artifact = { id: 'artifact', runId: 'run', attemptId: 'attempt', stepId: 'build', proposalRevision: 'proposal', output: 'codechange' as const,
    summary: 'Actual capture', increment: captured, hostSnapshot: true, createdAt: increment.createdAt };
  expect(workflowArtifactCheck({ ...artifact, contentHash: workflowArtifactHash(artifact) }).increment?.snapshotHash).toBe(captured.snapshotHash);
  const data = toLoaded(createSeed()).data!; data.increments['CF-001'] = captured;
  expect(parsePersistedStudio(data).increments['CF-001']?.snapshotHash).toBe(captured.snapshotHash);
});

it('keeps legacy absence explicit and rejects invalid or model-authored attestation', () => {
  expect(workflowIncrementCheck(increment).snapshotHash).toBeUndefined();
  expect(durableBuildResultCheck({ increment }).increment?.snapshotHash).toBeUndefined();
  for (const snapshotHash of ['short', 'A'.repeat(64), 42]) {
    expect(() => workflowIncrementCheck({ ...increment, snapshotHash })).toThrow();
    expect(() => durableBuildResultCheck({ increment: { ...increment, snapshotHash } })).toThrow();
  }
  expect(() => validateExecutionOutput({ stage: 'implement' }, { summary: 'Model claims a capture', snapshotHash: 'a'.repeat(64) })).toThrow();
});

it('requires explicit scoped exclusion disclosure and rejects paths outside the captured source', () => {
  const inspection = { version: 1, snapshot: { version: 1, id: 'snapshot', contentHash: 'a'.repeat(64) }, evidenceHash: 'b'.repeat(64), sourceKind: 'repository',
    baseCommit: 'c'.repeat(40), increment: null, fileCount: 0, totalBytes: 0, observedAt: increment.createdAt, humanCessationRequired: false };
  expect(backgroundBuildRetryInspectionCheck(inspection).captureScope).toBeUndefined();
  const excludedPaths = [{ path: 'node_modules', reason: 'git-ignored-agent-denied-directory' }];
  expect(backgroundBuildRetryInspectionCheck({ ...inspection, captureScope: 'coforge-source-code/v1', excludedPaths }).excludedPaths).toEqual(excludedPaths);
  expect(() => backgroundBuildRetryInspectionCheck({ ...inspection, captureScope: 'coforge-source-code/v1' })).toThrow('disclose');
  for (const path of ['../outside', '/absolute', 'C:/outside', 'a\\outside', 'a/../outside']) expect(() => backgroundBuildRetryInspectionCheck({ ...inspection, captureScope: 'coforge-source-code/v1', excludedPaths: [{ ...excludedPaths[0], path }] })).toThrow();
});
