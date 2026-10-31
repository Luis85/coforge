import { describe, expect, it } from 'vitest';
import { recordAgentConversation } from '../../../features/coforge/application/agent-conversation';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { fixture, ai } from './configured-workflow-fixture';

describe('private per-attempt conversation evidence', () => {
  it('durably captures the original request and rejected response before a failed attempt, without rewriting it on retry', async () => {
    let attempt = 0;
    const f = await fixture([ai('analysis')], async input => {
      await input.onConversation?.({ kind: 'request', instructions: 'Captured instructions', prompt: `Original prompt ${++attempt}` });
      await input.onConversation?.({ kind: 'response', text: 'An invalid answer' });
      throw new Error('Output was rejected');
    });
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    const first = f.store.snapshot().jobs.at(-1)!;
    expect(first.status).toBe('failed');
    expect(first.conversation).toMatchObject({ instructions: { text: 'Captured instructions', truncated: false }, prompt: { text: 'Original prompt 1' }, response: { text: 'An invalid answer' }, simulated: false });
    const loaded = await f.storage.load();
    expect(parsePersistedStudio(loaded.data).jobs.at(-1)?.conversation).toEqual(first.conversation);
    const reloaded = new StudioStore(f.storage); await reloaded.init();
    expect(reloaded.snapshot().jobs.at(-1)?.conversation).toEqual(first.conversation);
    await f.engine.runWorkflowStep(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.store.snapshot().jobs.find(job => job.id === first.id)?.conversation).toEqual(first.conversation);
    expect(f.store.snapshot().jobs.at(-1)?.conversation?.prompt.text).toBe('Original prompt 2');
    await f.engine.stop();
  });

  it('bounds evidence with an explicit truncation flag and keeps historical absence honest', async () => {
    const f = await fixture([ai('analysis')]);
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    const job = f.store.snapshot().jobs.at(-1)!;
    expect(job.conversation).toBeUndefined();
    await recordAgentConversation(f.store, job.id, { kind: 'request', instructions: 'i'.repeat(64001), prompt: 'p'.repeat(64000), simulated: true });
    await recordAgentConversation(f.store, job.id, { kind: 'response', text: 'r'.repeat(64001) });
    const captured = f.store.snapshot().jobs.at(-1)?.conversation;
    expect(captured?.instructions).toEqual({ text: 'i'.repeat(64000), truncated: true });
    expect(captured?.prompt.truncated).toBe(false);
    expect(captured?.response).toEqual({ text: 'r'.repeat(64000), truncated: true });
    expect(captured?.simulated).toBe(true);
    await expect(recordAgentConversation(f.store, job.id, { kind: 'request', instructions: 'changed', prompt: 'changed' })).rejects.toThrow('already captured');
    await f.engine.stop();
  });
});
