import { expect, it } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { createSeed } from '../../../features/coforge/domain/seed';
import { MemoryStorage, nodeTimers } from './memory-storage';

it('protects the project workspace and captured RICE inputs during manual waits while allowing future workflow revisions', async () => {
  const runner = async () => { throw new Error('A manual checkpoint must not call a model.'); };
  const studio = new StudioService(new MemoryStorage(createSeed()), { runners: { demo: runner, claude: runner }, timers: nodeTimers(),
    probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  try {
    await studio.start();
    const projectId = studio.state().activeProjectId!;
    const definition = workflowDefinition(studio.state().settings);
    definition.steps = [{ id: 'review', name: 'Review', kind: 'approval', instructions: 'Review captured evidence.' }];
    await studio.saveWorkflow(projectId, definition, JSON.stringify(workflowDefinition(studio.state().settings)));
    await studio.startWorkflow('CF-101');
    await expect(studio.updateProject({ projectPath: '/different/project' })).rejects.toThrow('workflow');
    await expect(studio.updateIntegration({ projectPath: '/different/project' })).rejects.toThrow('workflow');
    await expect(studio.loadSample()).rejects.toThrow('workflow');
    const rice = studio.state().ideas.find(idea => idea.id === 'CF-101')!.rice!;
    await expect(studio.adjustRice('CF-101', { reach: 100, impact: 1, confidence: 0.8, effort: 2, rationale: 'A new manual estimate' })).rejects.toThrow('captured');
    expect(studio.state().ideas.find(idea => idea.id === 'CF-101')!.rice).toEqual(rice);
    const original = workflowDefinition(studio.state().settings);
    await studio.saveWorkflow(projectId, { ...original, name: 'Future revision' }, JSON.stringify(original));
    expect(studio.state().ideas.find(idea => idea.id === 'CF-101')!.workflowRun?.definition.name).not.toBe('Future revision');
    await studio.updateSettings({ paused: true });
    await studio.stopWorkflow('CF-101');
    await studio.updateProject({ projectPath: '/different/project' });
    await studio.adjustRice('CF-101', { reach: 100, impact: 1, confidence: 0.8, effort: 2, rationale: 'A new manual estimate' });
    expect(studio.state().ideas.find(idea => idea.id === 'CF-101')!.rice?.reach).toBe(100);
  } finally { await studio.stop(); }
});
