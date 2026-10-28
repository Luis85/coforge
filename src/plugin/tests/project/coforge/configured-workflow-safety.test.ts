import { describe, expect, it, vi } from 'vitest';
import { workflowArtifactHash } from '../../../features/coforge/domain/configured-workflow-run';
import { ai, fixture, increment, result } from './configured-workflow-fixture';

describe('configured workflow safety and resource evidence', () => {
  it('keeps the authoritative successful host capture when the semantic result omits a duplicate diff', async () => {
    const f = await fixture([ai('edit', 'markdown', 'editworktree')], async input => {
      await input.onChanges?.(increment); return result(input);
    });
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.current().increment?.diff).toBe('+code');
    expect(f.current().workflowRun?.state).toBe('awaiting-review');
  });

  it('never lets a later Demo or summary-only codechange result erase earlier actual workspace changes', async () => {
    const f = await fixture([ai('real-edit', 'markdown', 'editworktree'), ai('summary-only', 'codechange', 'editworktree'), ai('demo-edit', 'codechange', 'editworktree')], async input => {
      if (input.workflow?.step.id === 'real-edit') {
        await input.onWorkspace?.('real-workspace');
        await input.onChanges?.({ ...increment, simulated: false });
        return result(input);
      }
      if (input.workflow?.step.id === 'demo-edit') return { summary: 'Demo edits', increment };
      return { summary: 'No changes in this task.' };
    });
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.current().increment).toMatchObject({ diff: '+code', simulated: false });
    expect(f.current().workflowRun?.state).toBe('awaiting-review');
  });

  it('never turns a verified empty real workspace into simulated pending changes or implementation credit', async () => {
    const f = await fixture([ai('real-edit', 'markdown', 'editworktree'), ai('revert', 'markdown', 'editworktree'), ai('demo-edit', 'codechange', 'editworktree')], async input => {
      if (input.workflow?.step.id === 'real-edit') { await input.onWorkspace?.('real-workspace'); await input.onChanges?.({ ...increment, simulated: false }); }
      if (input.workflow?.step.id === 'revert') await input.onChanges?.(null);
      if (input.workflow?.step.id === 'demo-edit') return { summary: 'Simulated changes', increment };
      return result(input);
    });
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    expect(f.current().increment).toBeUndefined();
    expect(f.current().workflowRun?.state).toBe('finished');
    expect(f.current().status).not.toBe('shipped');
  });

  it('applies future automatic-run intervals only to new starts, never to continuation of a pinned run', async () => {
    const f = await fixture([ai('first'), { ...ai('continue'), provider: 'claude' }], async input => {
      if (input.workflow?.step.id === 'first') await f.store.transaction(state => { state.runtime.cliAvailable = false; });
      return result(input);
    });
    await f.engine.tick(false); await f.engine.waitUntilIdle();
    const runningIdea = f.store.snapshot().ideas.find(idea => idea.workflowRun)!;
    expect(runningIdea.workflowRun?.state).toBe('ready');
    await f.store.transaction(state => {
      state.runtime.cliAvailable = true;
      state.settings.workflow!.limits.intervalSeconds = 3600;
    });
    await f.engine.tick(false); await f.engine.waitUntilIdle();
    expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['first', 'continue']);
    expect(f.store.snapshot().ideas.find(idea => idea.id === runningIdea.id)?.workflowRun?.state).toBe('finished');
  });

  it('skips a legacy pending review instead of starving other eligible configured requests', async () => {
    const f = await fixture([ai('report')]);
    let blockedId = '';
    await f.store.transaction(state => {
      const idea = state.ideas.find(item => !['shipped', 'rejected', 'flagged'].includes(item.status))!;
      blockedId = idea.id; idea.status = 'review'; idea.increment = increment;
    });
    const queued = await f.engine.tick(false); await f.engine.waitUntilIdle();
    expect(queued).not.toBeNull();
    expect(queued?.ideaId).not.toBe(blockedId);
    expect(f.store.snapshot().ideas.find(idea => idea.id === blockedId)?.workflowRun).toBeUndefined();
  });

  it('rejects output whose captured artifact inputs changed even when proposal text is unchanged', async () => {
    let entered: () => void = () => {};
    const started = new Promise<void>(resolve => { entered = resolve; });
    let resume: () => void = () => {};
    const waiting = new Promise<void>(resolve => { resume = resolve; });
    const f = await fixture([ai('source'), ai('consumer')], async input => {
      if (input.workflow?.step.id === 'consumer') { entered(); await waiting; }
      return result(input);
    });
    await f.engine.startWorkflow(f.idea.id); await started;
    await f.store.transaction(state => {
      const artifact = state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!.artifacts[0]!;
      artifact.markdown = 'A revised source artifact'; artifact.contentHash = workflowArtifactHash(artifact);
    });
    resume(); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun).toMatchObject({ state: 'attention', cursor: 1 });
    expect(f.store.snapshot().jobs.at(-1)?.error).toContain('input changed');
  });
  it('retains verified host changes when viewer content changes before semantic output returns', async () => {
    let entered: () => void = () => {};
    const started = new Promise<void>(resolve => { entered = resolve; });
    let resume: () => void = () => {};
    const waiting = new Promise<void>(resolve => { resume = resolve; });
    const f = await fixture([ai('edit', 'markdown', 'editworktree')], async input => {
      entered(); await waiting; await input.onChanges?.(increment); return result(input);
    });
    await f.engine.startWorkflow(f.idea.id); await started;
    await f.store.transaction(state => { state.ideas.find(idea => idea.id === f.idea.id)!.description += ' New viewer context'; });
    resume(); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun).toMatchObject({ state: 'attention', cursor: 0 });
    expect(f.current().increment?.diff).toBe('+code');
    expect(f.current().workflowRun?.artifacts.map(item => item.output)).toEqual(['codechange']);
  });

  it('requires native review verification and atomically rechecks the reviewed run and diff', async () => {
    const guard = vi.fn(async () => { await f.store.transaction(state => { state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!.revision++; }); });
    const f = await fixture([ai('real-code', 'codechange', 'editworktree')], async input => {
      await input.onWorkspace?.('real-workspace'); return { summary: 'Real changes', increment: { ...increment, simulated: false } };
    }, guard);
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    await expect(f.engine.action(f.idea.id, 'approve')).rejects.toThrow('changed during verification');
    expect(guard).toHaveBeenCalledWith('real-workspace', expect.objectContaining({ simulated: false }));
    expect(f.current().status).toBe('review');
    expect(f.current().workflowRun?.state).toBe('awaiting-review');
  });

  it('refuses real code acceptance without a host guard and rejects unattributed real changes', async () => {
    const f = await fixture([ai('real-code', 'codechange', 'editworktree')], async input => {
      await input.onWorkspace?.('real-workspace'); return { summary: 'Real changes', increment: { ...increment, simulated: false } };
    });
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    await expect(f.engine.action(f.idea.id, 'approve')).rejects.toThrow('Verify');
    const missing = await fixture([ai('unattributed', 'codechange', 'editworktree')], async () => ({ increment: { ...increment, simulated: false } }));
    await missing.engine.startWorkflow(missing.idea.id); await missing.engine.waitUntilIdle();
    expect(missing.current().workflowRun?.error).toContain('verified attributed');
    expect(missing.current().status).not.toBe('shipped');
  });

  it('checks evidence capacity before spending on another attempt and preserves existing history', async () => {
    const f = await fixture([ai('first'), { ...ai('second'), automatic: false }]);
    await f.engine.startWorkflow(f.idea.id); await f.engine.waitUntilIdle();
    await f.store.transaction(state => {
      const run = state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!;
      const original = run.artifacts[0]!;
      for (let index = 0; index < 110; index++) {
        const artifact = { ...original, id: `evidence-${index}`, markdown: 'a'.repeat(16000) };
        artifact.contentHash = workflowArtifactHash(artifact); run.artifacts.push(artifact);
      }
    });
    const before = f.current().workflowRun!.artifacts.length;
    await expect(f.engine.runWorkflowStep(f.idea.id)).rejects.toThrow('reserved evidence capacity');
    expect(f.calls).toHaveLength(1);
    expect(f.current().workflowRun?.artifacts).toHaveLength(before);
  });
});
