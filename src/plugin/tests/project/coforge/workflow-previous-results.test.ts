import { expect, it } from 'vitest';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { ai, fixture, increment, result } from './configured-workflow-fixture';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { nodeTimers } from './memory-storage';

it.each([false, true])('keeps all earlier results while requiring Design with optional host capture present=%s', async capture => {
  const steps = [
    ai('plan', 'plan'), ai('design', 'design', 'readproject'), ai('earlier-editor', 'markdown', 'editworktree'),
    { ...ai('build', 'codechange', 'editworktree'), inputs: ['design' as const], includePreviousResults: true },
  ];
  const simulation = createDemoRunner(nodeTimers(), [0, 0]);
  const f = await fixture(steps, async input => {
    if (input.workflow?.step.id === 'earlier-editor') {
      if (capture) {
        await input.onWorkspace?.('verified-test-workspace');
        await input.onChanges?.({ ...increment, simulated: false });
      }
      else return simulation(input);
    }
    return result(input);
  });
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    const build = f.calls.find(input => input.workflow?.step.id === 'build')!.workflow!;
    expect(build.inputArtifacts.map(artifact => artifact.output)).toEqual(capture
      ? ['plan', 'design', 'codechange', 'markdown'] : ['plan', 'design', 'markdown']);
    expect(build.inputArtifacts.find(artifact => artifact.output === 'codechange')?.hostSnapshot).toBe(capture ? true : undefined);
    if (!capture) expect(build.inputArtifacts.find(artifact => artifact.output === 'markdown')?.markdown).toContain('Simulated earlier-editor');
    expect(f.current().workflowRun?.state).toBe(capture ? 'awaiting-review' : 'finished');
    if (!capture) expect(f.current().increment).toBeUndefined();
    await f.store.init();
    expect(f.current().workflowRun?.definition.steps.at(-1)).toMatchObject({ inputs: ['design'], includePreviousResults: true });
  } finally { await f.engine.stop(); }
});

it('still holds Build when required Design is invalidated despite other earlier results', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  workflow.steps.splice(4, 0, ai('later-report'));
  const steps = workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: step.id !== 'implement', minVotes: 0,
    ...(step.id === 'implement' ? { inputs: ['design' as const], includePreviousResults: true } : {}) } : step);
  const f = await fixture(steps);
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    await f.store.transaction(state => {
      const run = state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!;
      run.invalidatedArtifactIds = run.artifacts.filter(artifact => artifact.output === 'design').map(artifact => artifact.id);
    });
    await expect(f.engine.runWorkflowStep(f.idea.id)).rejects.toThrow('preceding design artifact');
    expect(f.calls.some(input => input.workflow?.step.id === 'implement')).toBe(false);
  } finally { await f.engine.stop(); }
});

it.each([undefined, false])('retains explicit required-only input selection when includePreviousResults=%s', async flag => {
  const steps = [ai('plan', 'plan'), ai('design', 'design'), ai('report'),
    { ...ai('build', 'codechange', 'editworktree'), inputs: ['design' as const], includePreviousResults: flag }];
  const f = await fixture(steps);
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.calls.at(-1)?.workflow?.inputArtifacts.map(artifact => artifact.output)).toEqual(['design']);
  } finally { await f.engine.stop(); }
});
