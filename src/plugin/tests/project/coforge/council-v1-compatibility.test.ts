import { describe, expect, it } from 'vitest';
import { ai, fixture } from './configured-workflow-fixture';
import { workflowRunCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { v1ExecutionSummary } from '../../../features/coforge/application/execution-v1-adapter';

describe('Council integration preserves v1 authority', () => {
  it('keeps latest-per-type inputs while retaining every original historical artifact', async () => {
    const f = await fixture([ai('first'), ai('second'), { ...ai('consume'), inputs: ['markdown'] }]);
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.calls[2]?.workflow?.inputArtifacts.map(item => item.stepId)).toEqual(['second']);
    const captured = f.current().workflowRun!;
    const historical = workflowRunCheck(JSON.parse(JSON.stringify(captured)));
    const before = JSON.stringify(historical);
    const summary = v1ExecutionSummary(historical);
    expect(summary).toMatchObject({ kind: 'workflow-v1', id: captured.id, state: 'completed', sourceId: f.idea.id, contributions: 3 });
    expect(JSON.stringify(historical)).toBe(before);
    expect(historical.artifacts.map(item => item.stepId)).toEqual(['first', 'second', 'consume']);
  });

  it('exposes persisted checkpoints as human waits without creating AI work or approving a request', async () => {
    const f = await fixture([{ id: 'human', name: 'Inspect', kind: 'approval', instructions: 'Read the request.' }]);
    await f.engine.startWorkflow(f.idea.id);
    expect(v1ExecutionSummary(f.current().workflowRun!)).toMatchObject({ state: 'waiting-human', contributions: 0, currentAction: 'Inspect' });
    expect(f.calls).toHaveLength(0);
    expect(f.current().status).not.toBe('shipped');
    await f.engine.stop();
  });
});
