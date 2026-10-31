import { vi } from 'vitest';
import type { DurableBuildPort, DurableBuildRequest } from '../../../features/coforge/application/durable-build-ports';
import type { DurableBuildSnapshot, DurableBuildRef } from '../../../features/coforge/domain/durable-build';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed } from '../../../features/coforge/domain/seed';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { ai, definition, increment } from './configured-workflow-fixture';
import { MemoryStorage, nodeTimers } from './memory-storage';

export class FakeDurableBuilds implements DurableBuildPort {
  configureConcurrency = vi.fn(async (_maxBuilds: number) => {});
  readonly requests: DurableBuildRequest[] = [];
  readonly snapshots = new Map<string, DurableBuildSnapshot>();
  readonly providerLaunches: string[] = [];
  readiness = vi.fn(async () => ({ ready: true, message: 'Test worker ready.' }));
  prepare = vi.fn(async (request: DurableBuildRequest) => {
    this.requests.push(structuredClone(request));
    const ref: DurableBuildRef = { version: 1, executionId: request.jobId, workerId: 'worker', epoch: 1, inputHash: 'a'.repeat(64) };
    this.snapshots.set(ref.executionId, { version: 1, ref, sequence: 0, phase: 'prepared', createdAt: new Date().toISOString(), lastContactAt: new Date().toISOString(), elapsedSeconds: 0, logs: [] });
    return ref;
  });
  start = vi.fn(async (ref: DurableBuildRef) => { const snapshot = this.snapshots.get(ref.executionId)!; if (snapshot.phase === 'prepared') { snapshot.phase = 'running'; snapshot.sequence++; this.providerLaunches.push(ref.executionId); } return structuredClone(snapshot); });
  cancelUnstarted = vi.fn(async (jobId: string) => { const snapshot = this.snapshots.get(jobId); if (snapshot?.phase === 'prepared' && !this.providerLaunches.includes(jobId)) { snapshot.phase = 'cancelled'; snapshot.sequence++; } });
  inspect = vi.fn(async (ref: DurableBuildRef) => structuredClone(this.snapshots.get(ref.executionId)!));
  inspectRetained = vi.fn(async (ref: DurableBuildRef) => ({ version: 1 as const, ref, snapshot: structuredClone(this.snapshots.get(ref.executionId)!), observedAt: new Date().toISOString(), evidenceHash: 'b'.repeat(64) }));
  recover = vi.fn(async (ref: DurableBuildRef, _inspected: true, minimumSequence: number, _evidenceHash: string) => {
    const snapshot = this.snapshots.get(ref.executionId)!;
    if (['completed', 'failed', 'cancelled'].includes(snapshot.phase)) return structuredClone(snapshot);
    snapshot.phase = 'cancelled'; snapshot.sequence = Math.max(snapshot.sequence, minimumSequence) + 1; snapshot.cancellationRequested = true; return structuredClone(snapshot);
  });
  cancel = vi.fn(async (ref: DurableBuildRef) => { const snapshot = this.snapshots.get(ref.executionId)!; snapshot.phase = 'cancelled'; snapshot.sequence++; snapshot.cancellationRequested = true; return structuredClone(snapshot); });
  acknowledge = vi.fn(async (_ref: DurableBuildRef, _sequence: number) => {});
  detach = vi.fn(async () => {});
  complete(jobId: string) {
    const snapshot = this.snapshots.get(jobId)!;
    snapshot.sequence++; snapshot.phase = 'completed'; snapshot.workspaceId = `bg-${jobId}`; snapshot.workspaceCaptured = true;
    snapshot.increment = { ...increment, simulated: false };
    snapshot.result = { summary: 'Finished Build.', increment: { ...increment, simulated: false } };
  }
}
export async function durableFixture() {
  const seed = createSeed(); const first = seed.ideas.find(idea => idea.status === 'inbox')!;
  seed.ideas = [first, { ...structuredClone(first), id: 'CF-999', number: 999, title: 'Independent short task' }]; seed.jobs = [];
  seed.settings.workflow = definition([{ ...ai('build', 'codechange', 'editworktree'), provider: 'claude', execution: { mode: 'background' } }]);
  const storage = new MemoryStorage(seed); const store = new StudioStore(storage); await store.init();
  await store.transaction(state => { state.runtime.cliAvailable = true; state.integration.projectPath = '/synthetic/game'; state.integration.allowImplementation = true; state.runtime.durableBuild = { ready: true, message: 'Ready.' }; });
  const worker = new FakeDurableBuilds();
  const foreground = vi.fn(async (_input: StageInput) => ({ markdown: '# Short result' }));
  const options = { durableBuilds: worker, runners: { demo: foreground, claude: foreground }, timers: nodeTimers() };
  const engine = new WorkflowEngine(store, options);
  return { storage, store, worker, foreground, engine, options, id: first.id };
}
