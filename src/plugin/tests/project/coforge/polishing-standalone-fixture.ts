import { vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import type { BackgroundBuildRetryPort } from '../../../features/coforge/application/background-build-retry-ports';
import type { BackgroundBuildRetrySource, BackgroundBuildRetryInspection } from '../../../features/coforge/domain/background-build-retry';
import type { PolishingCodePort } from '../../../features/coforge/application/polishing-ports';
import { ai, definition, increment } from './configured-workflow-fixture';
import { seededStore, nodeTimers } from './memory-storage';
import { FakeDurableBuilds } from './durable-build-fixture';
import type { StageInput } from '../../../features/coforge/application/ports';

export async function standalonePolishingFixture(code = false) {
  const { store, storage } = await seededStore(); const ideaId = store.snapshot().ideas.find(idea => idea.status === 'inbox')!.id;
  await store.transaction(state => {
    const workflow = definition([ai('later')]); workflow.improvementPass = { provider: code ? 'claude' : 'demo', model: 'sonnet', instructions: 'Polish this result.', limits: { timeoutSeconds: 60, maxTurns: 3, maxBudgetUsd: 0.5 } };
    state.settings.workflow = workflow; state.runtime.cliAvailable = true; state.integration.projectPath = '/synthetic/game'; state.integration.allowImplementation = true;
    if (code) { const idea = state.ideas.find(item => item.id === ideaId)!; idea.authorId = 'twitch:legacy-polish-author'; idea.status = 'shipped'; idea.increment = { ...increment, simulated: false }; }
  });
  const worker = new FakeDurableBuilds(); worker.readiness = vi.fn(async () => ({ ready: true, reviewedSnapshots: true, message: 'Ready' }));
  const resources: BackgroundBuildRetryPort = { inspect: vi.fn(async (source: BackgroundBuildRetrySource): Promise<BackgroundBuildRetryInspection> => ({ version: 1, snapshot: { version: 1, id: 'snapshot', contentHash: 'a'.repeat(64) }, evidenceHash: 'b'.repeat(64), sourceKind: source.sourceKind,
    ...(source.sourceKind === 'workspace' ? { sourceOwner: source.sourceMaterializationId ? { kind: 'materialization' as const, id: source.sourceMaterializationId } : { kind: 'attempt' as const, jobId: source.sourceJobId!, attemptId: source.sourceAttemptId! } } : {}),
    ...(source.sourceWorkspaceId ? { sourceWorkspaceId: source.sourceWorkspaceId } : {}), baseCommit: 'c'.repeat(40), increment: source.expectedIncrement ?? null, fileCount: source.expectedIncrement?.files.length ?? 0, totalBytes: 5, observedAt: new Date().toISOString(), humanCessationRequired: !!(source.sourceJobId || source.executorJobId || source.executorCandidates?.length) })), verify: vi.fn(async () => {}) };
  const copies: PolishingCodePort = { materialize: vi.fn(async request => ({ id: request.id, workspaceId: 'bg-' + request.id, ownerRunId: request.target.runId, mode: request.target.mode, workspaceEpoch: request.target.workspaceEpoch,
    increment: { ...increment, simulated: false, branch: 'copy-' + request.id, worktree: '/synthetic/' + request.id }, evidenceHash: 'd'.repeat(64) })) };
  const runner = vi.fn(async (_input: StageInput) => ({ markdown: 'A clearer request description.' }));
  const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner }, timers: nodeTimers(), backgroundBuildRetries: resources, durableBuilds: worker, polishingCode: copies });
  const current = () => store.snapshot().ideas.find(idea => idea.id === ideaId)!;
  return { store, storage, worker, resources, copies, runner, engine, ideaId, current };
}
