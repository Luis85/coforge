import { expect, it } from 'vitest';
import { ai, fixture } from './configured-workflow-fixture';
import { managedPolishingSourceStopped } from '../../../features/coforge/application/managed-polishing-source';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';

it.each(['terminated', 'unknown', 'legacy', 'private', 'foreign', 'active'] as const)('uses actual source-session proof rather than another human checkbox: %s', async reason => {
  const f = await fixture([{ ...ai('build', 'codechange', 'editworktree'), provider: 'claude' }]);
  try {
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    await f.store.transaction(state => {
      const job = state.jobs[0]!, snapshot = job.workflow!; snapshot.workspaceId = 'source-workspace'; snapshot.lifecycle = { version: 1, mode: 'managed-session' };
      const owner = { runId: snapshot.runId, attemptId: snapshot.attemptId, projectId: job.projectId! };
      job.nativeProcess = { ...owner, phase: reason === 'unknown' ? 'unknown' : 'terminated', observedAt: new Date().toISOString(),
        identity: { pid: 123, platform: 'win32', birth: 'original', image: 'a'.repeat(64) },
        lifetime: { ...owner, version: 1, kind: 'windows-job', directory: '/owned', ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64) } };
      if (reason === 'legacy') delete snapshot.lifecycle;
      if (reason === 'private') job.nativeProcess.privateRuntime = { ...owner, directory: '/owned/private', ownerToken: 'd'.repeat(64) };
      if (reason === 'active') state.jobs.push({ ...job, id: 'another-writer', status: 'running', nativeProcess: undefined });
    });
    const state = f.store.internalSnapshot(), job = state.jobs[0]!, snapshot = job.workflow!;
    const source: BackgroundBuildRetrySource = { projectId: job.projectId!, ideaId: job.ideaId, runId: snapshot.runId, runRevision: 1, proposalRevision: snapshot.proposalRevision,
      stepId: snapshot.step.id, sourceKind: 'workspace', sourceWorkspaceId: reason === 'foreign' ? 'foreign-workspace' : 'source-workspace', projectPath: '/synthetic/game' };
    expect(managedPolishingSourceStopped(state, source, { sourceOwner: { kind: 'attempt', jobId: job.id, attemptId: snapshot.attemptId } })).toBe(reason === 'terminated');
  } finally { await f.engine.stop(); }
});
