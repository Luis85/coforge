import { expect, it } from 'vitest';
import { backgroundBuildRetrySourceCheck, backgroundBuildSnapshotRefCheck } from '../../../features/coforge/domain/background-build-retry';

const source = { projectId: 'project', ideaId: 'idea', runId: 'run', runRevision: 4, proposalRevision: 'proposal', stepId: 'build', projectPath: 'C:/game' };
it('requires attributed workspace identity for a partial-work source and permits explicit clean repository inspection', () => {
  expect(() => backgroundBuildRetrySourceCheck({ ...source, sourceKind: 'workspace' })).toThrow('workspace');
  expect(backgroundBuildRetrySourceCheck({ ...source, sourceKind: 'workspace', sourceWorkspaceId: 'original', sourceJobId: 'job', sourceAttemptId: 'attempt' })).toMatchObject({ sourceWorkspaceId: 'original' });
  expect(backgroundBuildRetrySourceCheck({ ...source, sourceKind: 'repository' })).toMatchObject({ sourceKind: 'repository' });
  expect(() => backgroundBuildRetrySourceCheck({ ...source, sourceKind: 'repository', sourceWorkspaceId: 'hidden-workspace' })).toThrow('workspace');
  expect(() => backgroundBuildRetrySourceCheck({ ...source, sourceKind: 'repository', sourceJobId: 'job' })).toThrow('attempt');
});
it('requires a content-bound immutable snapshot reference rather than a path supplied by a model', () => {
  expect(backgroundBuildSnapshotRefCheck({ version: 1, id: 'reviewed-snapshot', contentHash: 'a'.repeat(64) })).toEqual({ version: 1, id: 'reviewed-snapshot', contentHash: 'a'.repeat(64) });
  expect(() => backgroundBuildSnapshotRefCheck({ version: 1, id: 'reviewed-snapshot', contentHash: 'short' })).toThrow();
  expect(() => backgroundBuildSnapshotRefCheck({ version: 1, id: 'reviewed-snapshot', contentHash: 'a'.repeat(64), path: 'C:/arbitrary' })).toThrow();
});
