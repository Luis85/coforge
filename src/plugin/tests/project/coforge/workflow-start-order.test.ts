import { expect, it } from 'vitest';
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
