import { expect, it } from 'vitest';
import { durableBuildPolicyCheck, durableBuildRefCheck, durableBuildSnapshotCheck } from '../../../features/coforge/domain/durable-build';
import { workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { definition, ai } from './configured-workflow-fixture';

it('validates a captured100hour policy without changing legacy limits or silently enabling old steps', () => {
  const policy = durableBuildPolicyCheck({ mode: 'background', maxRuntimeSeconds: 360000 });
  expect(durableBuildPolicyCheck({ mode: 'background' })).toEqual({ mode: 'background' });
  expect(durableBuildPolicyCheck({ mode: 'background', idleWarningSeconds: 0, maxTurns: 100000, maxBudgetUsd: 10000 })).toMatchObject({ idleWarningSeconds: 0 });
  const source = definition([{ ...ai('build', 'codechange', 'editworktree'), provider: 'claude', execution: policy }]);
  expect(workflowDefinitionCheck(source).steps[0]).toHaveProperty('execution', policy);
  expect(workflowDefinitionCheck(definition([ai('legacy')])).steps[0]).not.toHaveProperty('execution');
  expect(workflowDefinitionCheck(source).limits).toEqual(source.limits);
  expect(() => durableBuildPolicyCheck({ ...policy, maxRuntimeSeconds: 0 })).toThrow();
  expect(() => durableBuildPolicyCheck({ ...policy, maxRuntimeSeconds: Infinity })).toThrow();
  expect(() => workflowDefinitionCheck(definition([{ ...ai('analysis'), provider: 'claude', execution: policy }]))).toThrow();
  expect(() => workflowDefinitionCheck(definition([{ ...ai('build', 'codechange', 'editworktree'), execution: policy }]))).toThrow();
});

it('validates bounded snapshots and rejects identity/state/unknown wire fields', () => {
  const ref = durableBuildRefCheck({ version: 1, executionId: 'execution', workerId: 'worker', epoch: 1, inputHash: 'a'.repeat(64) });
  const snapshot = { version: 1, ref, sequence: 1, phase: 'running', createdAt: '2026-10-31T12:00:00Z', lastContactAt: '2026-10-31T12:00:01Z', elapsedSeconds: 360001, logs: ['Still working.'] };
  expect(durableBuildSnapshotCheck(snapshot)).toMatchObject({ elapsedSeconds: 360001 });
  expect(() => durableBuildSnapshotCheck({ ...snapshot, phase: 'maybe-finished' })).toThrow();
  expect(() => durableBuildSnapshotCheck({ ...snapshot, logs: Array.from({ length: 51 }, () => 'line') })).toThrow();
  expect(() => durableBuildSnapshotCheck({ ...snapshot, token: 'forbidden' })).toThrow();
  expect(() => durableBuildRefCheck({ ...ref, epoch: 0 })).toThrow();
});
