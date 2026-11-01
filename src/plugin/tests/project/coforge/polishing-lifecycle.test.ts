import { expect, it } from 'vitest';
import { retryFixture, consent } from './background-build-retry-fixture';
import { executionTaskPrompt } from '../../../features/coforge/application/workflow-execution';
import { standalonePolishingFixture } from './polishing-standalone-fixture';

it('captures feedback and an independent text result while leaving the main workflow checkpoint and original artifacts unchanged', async () => {
  const f = await retryFixture(false);
  try {
    await f.store.transaction(state => { state.settings.workflow!.improvementPass = { provider: 'demo', model: 'sonnet', instructions: 'Polish the current result.', limits: { timeoutSeconds: 60, maxTurns: 3, maxBudgetUsd: 0.5 } }; });
    const before = f.current();
    f.runner.mockImplementationOnce(async () => ({ markdown: '# Polished design' }));
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Explain the recovery behavior clearly.');
    expect(preview.target.kind).toBe('design'); expect(preview.feedback).toContain('recovery');
    expect(f.current()).toEqual(before); expect(f.worker.prepare).not.toHaveBeenCalled();
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const after = f.current(); const polish = after.polishingRuns![0]!;
    expect(after.workflowRun).toEqual(before.workflowRun); expect(after.plan).toEqual(before.plan); expect(after.description).toBe(before.description);
    expect(polish.workflow.state).toBe('awaiting-review'); expect(polish.review).toBe('pending');
    expect(polish.workflow.artifacts.at(-1)?.markdown).toBe('# Polished design');
    expect(executionTaskPrompt(f.runner.mock.calls.at(-1)![0])).toContain(preview.feedback);
    await expect(f.engine.runWorkflowStep(f.ideaId)).rejects.toThrow('polish');
    await f.engine.rejectPolishingResult(f.ideaId, polish.id, polish.workflow.revision);
    expect(f.current().workflowRun).toEqual(before.workflowRun); expect(f.current().polishingRuns![0]?.review).toBe('rejected');
  } finally { await f.engine.stop(); }
});

it('supports request text without a main run and retains its generated result until explicit review', async () => {
  const f = await standalonePolishingFixture();
  try {
    const before = f.current();
    f.runner.mockImplementationOnce(async () => ({ markdown: 'A clearer request description.' }));
    const preview = await f.engine.previewPolishingPass(f.ideaId, 'Make the description clear.');
    expect(preview.target.kind).toBe('request');
    await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    expect(f.current().workflowRun).toBeUndefined(); expect(f.current().description).toBe(before.description);
    expect(f.current().polishingRuns![0]?.workflow.artifacts.at(-1)?.markdown).toBe('A clearer request description.');
  } finally { await f.engine.stop(); }
});
