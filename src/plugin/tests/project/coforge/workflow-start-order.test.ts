import { expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { defaultWorkflowDefinition, workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { createSeed } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('serializes a legacy start before a later definition save without an extra preparation boundary', async () => {
  const seed = createSeed();
  const definition = { ...defaultWorkflowDefinition(seed.settings), name: 'Captured first', revision: 'legacy-order', steps: [{ id: 'review', kind: 'approval' as const, name: 'Review', instructions: 'The original instructions.' }] };
  seed.settings.workflow = definition;
  const studio = new StudioService(new MemoryStorage(seed), { timers: nodeTimers(), runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start();
  try {
    const idea = studio.state().ideas.find(item => item.status === 'inbox')!;
    const expected = JSON.stringify(workflowDefinition(studio.state().settings));
    const starting = studio.startWorkflow(idea.id);
    const saving = studio.saveWorkflow(studio.state().activeProjectId!, { ...definition, name: 'For later runs', steps: [{ ...definition.steps[0]!, instructions: 'Later instructions.' }] }, expected);
    const [run] = await Promise.all([starting, saving]);
    expect(run.definition.name).toBe('Captured first');
    expect(run.definition.steps[0]?.instructions).toBe('The original instructions.');
    expect(run.councilBindings).toBeUndefined();
    expect(studio.state().settings.workflow?.name).toBe('For later runs');
  } finally { await studio.stop(); }
});

it('rejects an assignment added by an earlier queued save instead of admitting uncaptured fallback settings', async () => {
  const seed = createSeed(); const base = defaultWorkflowDefinition(seed.settings);
  const ai = base.steps[0]!; if (ai.kind !== 'ai') throw new Error('Expected AI step');
  const definition = { ...base, name: 'Manual snapshot', revision: 'earlier-save', steps: [{ id: 'review', kind: 'approval' as const, name: 'Review', instructions: 'Review first.' }] };
  seed.settings.workflow = definition;
  const prepareCoworker = vi.fn(async () => ({ format: 'coforge-workflow-coworker/v1' as const, id: 'worker', name: 'Saved worker', revision: 'worker-revision', role: 'Reviewer', instructions: 'Keep compatibility.', provider: 'demo' as const, model: 'sonnet' }));
  const runner = vi.fn(async () => ({}));
  const studio = new StudioService(new MemoryStorage(seed), { timers: nodeTimers(), runners: { demo: runner, claude: runner }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }), agentTasks: { prepareCoworker, create: async () => { throw new Error('No delegation'); } } });
  await studio.start();
  try {
    const idea = studio.state().ideas.find(item => item.status === 'inbox')!;
    const saving = studio.saveWorkflow(studio.state().activeProjectId!, { ...definition, name: 'Assigned definition', steps: [...definition.steps, { ...ai, coworkerId: 'worker', automatic: false }] }, JSON.stringify(workflowDefinition(studio.state().settings)));
    const starting = studio.startWorkflow(idea.id);
    const rejected = expect(starting).rejects.toThrow('CoWorker workflow changed');
    await Promise.all([saving, rejected]);
    expect(studio.state().ideas.find(item => item.id === idea.id)?.workflowRun).toBeUndefined();
    expect(studio.state().jobs.filter(job => job.ideaId === idea.id)).toHaveLength(0);
    expect(prepareCoworker).not.toHaveBeenCalled(); expect(runner).not.toHaveBeenCalled();
    const captured = await studio.startWorkflow(idea.id);
    expect(captured.coworkerBindings).toMatchObject([{ stepId: ai.id, profile: { id: 'worker', revision: 'worker-revision' } }]);
    expect(prepareCoworker).toHaveBeenCalledTimes(1);
  } finally { await studio.stop(); }
});
