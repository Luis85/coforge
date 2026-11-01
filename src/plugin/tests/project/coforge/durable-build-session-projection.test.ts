import { expect, it } from 'vitest';
import { durableFixture } from './durable-build-fixture';
import { appendAgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import { agentSessionFollowView } from '../../../infrastructure/coforge/agent-session-follow-view';

it('follows live background observations from the exact original snapshot, excludes foreign/stale snapshots and retains terminal observations canonically', async () => {
  const fixture = await durableFixture();
  try {
    await fixture.engine.startWorkflow(fixture.id); await fixture.engine.waitUntilIdle();
    const job = fixture.store.snapshot().jobs[0]!; const snapshot = fixture.worker.snapshots.get(job.id)!;
    const trace = appendAgentSessionEvent(undefined, { kind: 'message', sessionId: 'root', text: 'Native background progress' }, new Date().toISOString());
    snapshot.sequence++; snapshot.sessionTrace = trace;
    await fixture.engine.reconcileDurableBuild(fixture.id);
    const state = fixture.store.snapshot(); expect(state.jobs[0]?.sessionTrace).toBeUndefined();
    expect(agentSessionFollowView(state, job.id)?.trace).toEqual(trace);
    const foreign = structuredClone(state); foreign.runtime.durableBuildSnapshots![job.id]!.ref.inputHash = 'f'.repeat(64);
    expect(agentSessionFollowView(foreign, job.id)).toBeUndefined();
    const stale = structuredClone(state); stale.runtime.durableBuildSnapshots![job.id]!.sequence = 0;
    expect(agentSessionFollowView(stale, job.id)).toBeUndefined();
    const otherProject = structuredClone(state); otherProject.activeProjectId = 'foreign-project';
    expect(agentSessionFollowView(otherProject, job.id)).toBeUndefined();
    fixture.worker.complete(job.id); await fixture.engine.reconcileDurableBuild(fixture.id);
    expect(fixture.store.snapshot().jobs[0]?.sessionTrace).toEqual(trace);
    expect(fixture.worker.providerLaunches).toEqual([job.id]);
  } finally { await fixture.engine.stop(); }
});
