import { expect, it } from 'vitest';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { ai, fixture, increment, result } from './configured-workflow-fixture';
import { presetWorkflowStep } from '../../../presentation/stores/workflow-editor-draft';
import { cardState } from '../../../presentation/composables/coforge/use-board-card';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { createDemoRunner } from '../../../features/coforge/application/demo-agent';
import { nodeTimers } from './memory-storage';

it('does not insert Design or reinterpret inputs in an explicitly saved four-step legacy workflow', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  const legacy = workflow.steps.filter(step => step.id !== 'design').map(step => step.kind === 'ai'
    ? { ...step, automatic: true, minVotes: 0, inputs: undefined } : step);
  const f = await fixture(legacy);
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['screen', 'score', 'plan', 'implement']);
    expect(f.current().workflowRun?.artifacts.some(artifact => artifact.output === 'design')).toBe(false);
    expect(f.current().workflowRun?.definition.steps).toEqual(legacy);
    await f.store.init();
    expect(f.current().workflowRun?.definition.steps).toEqual(legacy);
  } finally { await f.engine.stop(); }
});

it('runs the actual Simulation provider with a plan-grounded specification and binds it into Build', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  const f = await fixture(workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: true, minVotes: 0 } : step), createDemoRunner(nodeTimers(), [0, 0]));
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    const artifacts = f.current().workflowRun!.artifacts;
    const design = artifacts.find(artifact => artifact.output === 'design');
    const plan = artifacts.find(artifact => artifact.output === 'plan')?.plan;
    expect(design?.markdown).toContain('Simulated Design:');
    expect(design?.markdown).toContain(plan?.summary);
    expect(design?.markdown).toContain('### Components and data');
    expect(design?.markdown).toContain('### Acceptance scenario');
    expect(design?.markdown).toContain('### Failure and recovery');
    expect(design?.markdown).toContain('### Open questions');
    expect(design?.markdown).toContain('no model was called');
    const build = f.calls.find(input => input.workflow?.step.id === 'implement')!.workflow!;
    expect(build.inputArtifacts.map(artifact => artifact.output)).toEqual(['plan', 'design']);
    expect(build.inputArtifacts[1]).toEqual(design);
    expect(f.current().increment?.simulated).toBe(true);
    expect(f.current().workflowRun?.state).toBe('awaiting-review');
  } finally { await f.engine.stop(); }
});

it('passes the Design specification to Build when a later step produces a generic Markdown report', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  workflow.steps.splice(4, 0, ai('later-report'));
  const f = await fixture(workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: true, minVotes: 0 } : step), async input => {
    if (input.workflow?.step.id === 'design') return { markdown: '# Retained specification' };
    if (input.workflow?.step.id === 'later-report') return { markdown: '# Later report, not the specification' };
    return result(input);
  });
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    const inputs = f.calls.find(input => input.workflow?.step.id === 'implement')?.workflow?.inputArtifacts;
    expect(inputs?.map(artifact => artifact.stepId)).toEqual(['plan', 'design']);
    expect(inputs?.find(artifact => artifact.stepId === 'design')?.markdown).toBe('# Retained specification');
  } finally { await f.engine.stop(); }
});

it('cannot substitute a generic Markdown report for an invalidated Design specification', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  workflow.steps.splice(4, 0, ai('later-report'));
  const f = await fixture(workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: step.id !== 'implement', minVotes: 0 } : step));
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    await f.store.transaction(state => {
      const run = state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!;
      run.invalidatedArtifactIds = run.artifacts.filter(artifact => artifact.stepId === 'design').map(artifact => artifact.id);
    });
    await expect(f.engine.runWorkflowStep(f.idea.id)).rejects.toThrow('preceding design artifact');
    expect(f.calls.some(input => input.workflow?.step.id === 'implement')).toBe(false);
  } finally { await f.engine.stop(); }
});

it('runs Design after Plan and passes its retained specification into Build', async () => {
  const settings = defaultSettings();
  const workflow = defaultWorkflowDefinition(settings);
  expect(workflow.steps.map(step => step.name)).toEqual(['Screen', 'Score', 'Plan', 'Design', 'Build']);
  expect(workflow.steps[3]).toMatchObject({ kind: 'ai', output: 'design', access: 'readproject', inputs: ['plan'] });
  const f = await fixture(workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: true, minVotes: 0 } : step), async input => {
    if (input.workflow?.step.id === 'design') return { markdown: '# Specification\n\nUse the existing interaction and save format.' };
    if (input.workflow?.step.id === 'implement') return { increment };
    return result(input);
  });
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.calls.map(input => input.workflow?.step.id)).toEqual(['screen', 'score', 'plan', 'design', 'implement']);
    const build = f.calls.at(-1)?.workflow;
    expect(build?.inputArtifacts.map(artifact => artifact.output)).toEqual(['plan', 'design']);
    expect(build?.inputArtifacts[1]?.markdown).toContain('Use the existing interaction and save format.');
    expect(f.current().workflowRun?.state).toBe('awaiting-review');
    expect(f.current().status).toBe('review');
    expect(JSON.stringify(buildPublicBoard(f.store.snapshot()))).not.toContain('Use the existing interaction and save format.');
    await f.store.init();
    expect(f.current().workflowRun?.artifacts.find(artifact => artifact.stepId === 'design')?.markdown).toContain('# Specification');
  } finally { await f.engine.stop(); }
});

it('requires the saved specification before Build can be dispatched', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  const f = await fixture(workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: step.id !== 'implement', minVotes: 0 } : step));
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.cursor).toBe(4);
    expect(cardState(f.current(), undefined)?.label).toBe('Design complete · Ready to build');
    const planned = f.current();
    const stale = { ...planned, description: `${planned.description} Changed request` };
    expect(cardState(stale, undefined)?.label).not.toContain('Design complete');
    expect(cardState({ ...planned, workflowRun: { ...planned.workflowRun!, state: 'stopped' } }, undefined)?.label).toBe('Plan ready');
    const designJob = f.store.snapshot().jobs.find(job => job.workflow?.step.id === 'design')!;
    expect(cardState(f.current(), { ...designJob, status: 'running' })?.label).toBe('Design running');
    await f.store.transaction(state => {
      const run = state.ideas.find(idea => idea.id === f.idea.id)!.workflowRun!;
      run.invalidatedArtifactIds = run.artifacts.filter(artifact => artifact.stepId === 'design').map(artifact => artifact.id);
    });
    expect(cardState(f.current(), undefined)?.label).not.toContain('Design complete');
    await expect(f.engine.runWorkflowStep(f.idea.id)).rejects.toThrow('preceding design artifact');
    expect(f.calls.some(input => input.workflow?.step.id === 'implement')).toBe(false);
    expect(f.current().plan).toBeDefined();
  } finally { await f.engine.stop(); }
});

it('offers an independently editable Design preset with read-only access', () => {
  const settings = defaultSettings();
  const preset = presetWorkflowStep('design', settings);
  expect(preset).toMatchObject({ name: 'Design', output: 'design', access: 'readproject', inputs: ['plan'] });
  expect(preset.id).not.toBe('design');
  expect(settings.workflow).toBeUndefined();
});

it('preserves a maximum-length custom Build prompt while requiring the specification', () => {
  const instructions = 'x'.repeat(8000);
  const settings = { ...defaultSettings(), stagePrompts: { implement: instructions } };
  const build = defaultWorkflowDefinition(settings).steps.find(step => step.id === 'implement');
  expect(build).toMatchObject({ instructions, inputs: ['plan', 'design'] });
});

it('holds Build when Design fails, retaining the plan for an explicit retry', async () => {
  const workflow = defaultWorkflowDefinition(defaultSettings());
  const f = await fixture(workflow.steps.map(step => step.kind === 'ai' ? { ...step, automatic: true, minVotes: 0 } : step), async input => {
    if (input.workflow?.step.id === 'design') throw new Error('Design provider unavailable');
    return result(input);
  });
  try {
    await f.engine.startWorkflow(f.idea.id);
    await f.engine.waitUntilIdle();
    expect(f.current().workflowRun?.state).toBe('attention');
    expect(f.current().plan?.summary).toBe('Plan');
    expect(f.calls.some(input => input.workflow?.step.id === 'implement')).toBe(false);
    expect(f.current().workflowRun?.artifacts.some(artifact => artifact.stepId === 'design')).toBe(false);
  } finally { await f.engine.stop(); }
});
