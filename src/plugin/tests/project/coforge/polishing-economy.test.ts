import { expect, it } from 'vitest';
import { standalonePolishingFixture } from './polishing-standalone-fixture';
import { consent } from './background-build-retry-fixture';
import { registerPlayer } from '../../../features/coforge/application/population';

it.each(['apply', 'reject'] as const)('does not award original feature acceptance for %s of legacy shipped polishing when the author registered later', async action => {
  const f = await standalonePolishingFixture(true);
  try {
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Polish the accepted current code.');
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!; f.worker.complete(job.id); await f.engine.reconcileDurableBuild(f.ideaId, job.workflow!.runId);
    expect(f.current().status).toBe('review');
    await f.store.transaction(state => { registerPlayer(state, f.current().authorId); });
    const before = f.store.snapshot().population!.players.find(player => player.id === f.current().authorId)!;
    expect(before.rewardClaims).not.toContain(`accepted:${f.ideaId}`);
    const pass = f.current().polishingRuns![0]!;
    if (action === 'apply') await f.engine.applyPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    else await f.engine.rejectPolishingResult(f.ideaId, pass.id, pass.workflow.revision);
    expect(f.current().status).toBe('shipped');
    const after = f.store.snapshot().population!.players.find(player => player.id === before.id)!;
    expect(after.xp).toBe(before.xp); expect(after.reputation).toBe(before.reputation); expect(after.rewardClaims).toEqual(before.rewardClaims);
    expect(f.store.snapshot().population!.rewards.some(reward => reward.ideaId === f.ideaId && reward.reason === 'accepted')).toBe(false);
  } finally { await f.engine.stop(); }
});
