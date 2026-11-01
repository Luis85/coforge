import { vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { BackgroundBuildRetryPort } from '../../../features/coforge/application/background-build-retry-ports';
import type { BackgroundBuildRetryInspection, BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import { ai, definition, increment } from './configured-workflow-fixture';
import { FakeDurableBuilds } from './durable-build-fixture';
import { nodeTimers, seededStore } from './memory-storage';

export const consent = { oldExecutorStopped: true, changesReviewed: true, releaseStopHold: true };
export async function retryFixture(partial = true, prefixEdits = false, followup = false) {
  const { store, storage } = await seededStore();
  await store.transaction(state => {
    const first = prefixEdits ? { ...ai('earlier-edit', 'codechange', 'editworktree'), provider: 'claude' as const, automatic: false } : { ...ai('design', 'design'), automatic: false };
    const workflow = definition([first, { ...ai('build', 'codechange', 'editworktree'), provider: 'claude', automatic: false }]);
    if (followup) workflow.steps.push({ ...ai('followup'), automatic: false, inputs: ['codechange'] });
    workflow.limits.maxTurns = 7; workflow.limits.maxBudgetUsd = 1.5;
    state.settings.workflow = workflow; state.settings.paused = true;
    state.integration.projectPath = '/synthetic/game'; state.integration.allowImplementation = true;
    state.runtime.cliAvailable = true; state.runtime.durableBuild = { ready: true, message: 'Ready.' };
  });
  const ideaId = store.snapshot().ideas.find(idea => idea.status === 'inbox')!.id;
  const worker = new FakeDurableBuilds();
  worker.readiness = vi.fn(async () => ({ ready: true, message: 'Test worker ready.', reviewedSnapshots: true }));
  const resources: BackgroundBuildRetryPort = {
    inspect: vi.fn(async (source: BackgroundBuildRetrySource): Promise<BackgroundBuildRetryInspection> => ({ version: 1, snapshot: { version: 1, id: 'reviewed', contentHash: 'a'.repeat(64) }, evidenceHash: 'b'.repeat(64),
      sourceKind: source.sourceKind, ...(source.sourceWorkspaceId ? { sourceWorkspaceId: source.sourceWorkspaceId } : {}), baseCommit: 'c'.repeat(40), increment: partial || prefixEdits ? { ...increment, simulated: false } : null,
      ...(source.sourceKind === 'workspace' ? { sourceOwner: source.sourceMaterializationId ? { kind: 'materialization' as const, id: source.sourceMaterializationId } : { kind: 'attempt' as const, jobId: source.sourceJobId!, attemptId: source.sourceAttemptId! } } : {}),
      fileCount: partial || prefixEdits ? 1 : 0, totalBytes: partial || prefixEdits ? 5 : 0, observedAt: new Date().toISOString(), humanCessationRequired: !!(source.sourceAttemptId || source.executorAttemptId || source.executorCandidates?.length) })),
    verify: vi.fn(async () => {}),
  };
  const runner = vi.fn(async (input: StageInput) => {
    if (input.workflow?.step.id === 'design') return { markdown: '# Completed design' };
    if (input.workflow?.step.id === 'followup') return { markdown: '# Checked current cumulative work' };
    if (input.workflow?.step.id === 'earlier-edit') { await input.onWorkspace?.('fg-original'); await input.onChanges?.({ ...increment, simulated: false }); return { summary: 'Completed earlier code changes', increment: { ...increment, simulated: false } }; }
    if (partial) { await input.onWorkspace?.('fg-original'); await input.onChanges?.({ ...increment, simulated: false }); }
    throw new Error('Legacy Build timed out.');
  });
  const engine = new WorkflowEngine(store, { backgroundBuildRetries: resources, durableBuilds: worker, runners: { demo: runner, claude: runner }, timers: nodeTimers() });
  await engine.startWorkflow(ideaId); await engine.waitUntilIdle();
  if (partial) { await engine.runWorkflowStep(ideaId); await engine.waitUntilIdle(); }
  const current = () => store.snapshot().ideas.find(idea => idea.id === ideaId)!;
  return { store, storage, worker, resources, runner, engine, ideaId, current };
}
