import { expect, it, vi } from 'vitest';
import { recordAgentSessionEvent } from '../../../features/coforge/application/agent-session';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { fixture, ai, result } from './configured-workflow-fixture';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';

it('shows and persists observations while a provider is still running, then retains them after reload', async () => {
  let resume: () => void = () => {};
  const blocked = new Promise<void>(resolve => { resume = resolve; });
  const f = await fixture([ai('analysis')], async input => {
    await input.onSessionEvent?.({ kind: 'session', sessionId: 'native-root', status: 'running' });
    await input.onSessionEvent?.({ kind: 'message', sessionId: 'child', parentSessionId: 'native-root', text: 'Observed public output' });
    await blocked;
    return result(input);
  });
  try {
    await f.engine.startWorkflow(f.idea.id);
    await expect.poll(() => f.store.snapshot().jobs.at(-1)?.sessionTrace?.events.length).toBe(2);
    const running = f.store.snapshot().jobs.at(-1)!;
    expect(running.status).toBe('running');
    expect(JSON.stringify(buildPublicBoard(f.store.snapshot()))).not.toContain('Observed public output');
    expect(parsePersistedStudio((await f.storage.load()).data).jobs.at(-1)?.sessionTrace).toEqual(running.sessionTrace);
    resume(); await f.engine.waitUntilIdle();
    const reloaded = new StudioStore(f.storage); await reloaded.init();
    expect(reloaded.snapshot().jobs.at(-1)?.sessionTrace).toEqual(running.sessionTrace);
  } finally { resume(); await f.engine.waitUntilIdle(); await f.engine.stop(); }
});

it('cannot change execution ownership or result when observation validation or persistence fails', async () => {
  const f = await fixture([ai('analysis')]);
  await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
  const job = f.store.snapshot().jobs.at(-1)!;
  const save = vi.spyOn(f.storage, 'save').mockRejectedValueOnce(new Error('Observation storage unavailable'));
  await expect(recordAgentSessionEvent(f.store, job.id, { kind: 'message', text: 'Not saved' })).resolves.toBeUndefined();
  expect(f.store.snapshot().jobs.at(-1)).toEqual(job);
  save.mockRestore();
  await expect(recordAgentSessionEvent(f.store, job.id, { kind: 'message', text: 'x'.repeat(2049) })).resolves.toBeUndefined();
  expect(f.store.snapshot().jobs.at(-1)).toEqual(job);
  await recordAgentSessionEvent(f.store, job.id, { kind: 'message', text: 'Now observed' });
  expect(f.store.snapshot().jobs.at(-1)?.sessionTrace?.events[0]?.text).toBe('Now observed');
  expect(f.store.snapshot().jobs.at(-1)?.status).toBe(job.status);
  await f.engine.stop();
});
