// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { councilAskFixture, askButton } from './council-ask-fixture';

it('waits for active fan-out members before offering retry, snapshot continuation or skipping', async () => {
  const env = await councilAskFixture();
  try {
    await env.fill();
    await env.wrapper.get('.cf-council-task-composer form').trigger('submit');
    await flushPromises();
    await askButton(env.wrapper, 'Submit reviewed task').trigger('click');
    await flushPromises();
    const snapshot = env.module.actions.snapshot();
    const run = snapshot.runs[0];
    if (!run || !run.invocations[0]) throw new Error('Missing captured test run.');
    run.state = 'attention';
    run.attempts.push({ id: 'still-active', invocationId: run.invocations[0].id, status: 'dispatching', startedAt: new Date().toISOString(), dispatch: { prompt: 'Captured independent input', inputArtifactIds: [] } });
    env.ui.state = snapshot; env.ui.inspectedRun = run.id; env.ui.tab = 'monitor'; env.ui.skipReason = 'Record a missing contribution';
    await flushPromises();
    for (const label of ['Retry eligible action', 'Continue using original snapshot', 'Record missing contribution'])
      expect(askButton(env.wrapper, label).attributes('disabled')).toBeDefined();
    expect(env.wrapper.text()).toContain('Wait for all active round members to settle');
    expect(askButton(env.wrapper, 'Cancel future work').attributes('disabled')).toBeUndefined();
    run.attempts[0]!.status = 'unknown'; env.ui.state = { ...snapshot, runs: [{ ...run }] };
    await flushPromises();
    expect(askButton(env.wrapper, 'Retry eligible action').attributes('disabled')).toBeUndefined();
  } finally { await env.dispose(); }
});
