import { describe, expect, it } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import type { StageInput, StageRunner } from '../../../features/coforge/application/ports';
import { stageAgent } from '../../../features/coforge/domain/stage-agents';
import { applyProjectProperties, parseProjectNote, projectProperties } from '../../../features/coforge/domain/project-note';
import { seededStore, nodeTimers } from './memory-storage';

describe('Herdr project workflow configuration', () => {
  it('round-trips owned agent/model frontmatter and resets overrides without touching other properties', async () => {
    const { store } = await seededStore();
    const project = store.snapshot().projects![0]!;
    project.settings = { ...project.settings, provider: 'herdr', model: 'default-model', herdrAgent: 'claude', stageAgents: { plan: { provider: 'herdr', herdrAgent: 'claude', model: 'plan-model' } } };
    const properties = { ...projectProperties(project), custom: 'preserved' };
    const parsed = parseProjectNote(properties)!;
    expect(stageAgent(parsed.settings, 'plan')).toEqual({ provider: 'herdr', model: 'plan-model', herdrAgent: 'claude' });
    expect(stageAgent(parsed.settings, 'screen')).toEqual({ provider: 'herdr', model: 'default-model', herdrAgent: 'claude' });
    applyProjectProperties(properties, { ...project, settings: { ...project.settings, stageAgents: {} } });
    expect(properties).not.toHaveProperty('agent-herdr-agent-plan');
    expect(properties.custom).toBe('preserved');
  });
  it('checks availability before queueing and captures a selected model independently of later edits', async () => {
    const { store } = await seededStore();
    await store.transaction(state => {
      state.settings = { ...state.settings, provider: 'herdr', model: 'captured-model', herdrAgent: 'claude' };
      state.projects[0]!.projectPath = '/synthetic/project';
      state.integration.projectPath = '/synthetic/project';
    });
    const seen: StageInput[] = [];
    const runner: StageRunner = async input => { seen.push(input); return { screening: { provider: 'herdr', verdict: 'clear', signals: [], reason: 'Validated fixture', checkedAt: new Date().toISOString() } }; };
    const engine = new WorkflowEngine(store, { runners: { demo: runner, claude: runner, herdr: runner }, timers: nodeTimers() });
    try {
      await expect(engine.submit('CF-107', 'screen')).rejects.toThrow('Connect Herdr');
      expect(store.snapshot().jobs).toEqual([]);
      await store.updateRuntime({ herdrWorkflow: { ready: true, busy: false, message: 'Fixture connection' } });
      await engine.stop(); // Leave the queued job untouched while the project is edited.
      const job = await engine.submit('CF-107', 'screen');
      expect(job).toMatchObject({ provider: 'herdr', model: 'captured-model', herdrAgent: 'claude' });
      await store.transaction(state => { state.settings.model = 'later-model'; });
      engine.start();
      await engine.tick();
      // Submit another inbox candidate to trigger the queue worker after the settings edit.
      await engine.submit('CF-108', 'screen');
      await engine.waitUntilIdle();
      expect(seen.find(input => input.jobId === job.id)?.settings).toMatchObject({ provider: 'herdr', model: 'captured-model', herdrAgent: 'claude' });
      expect(store.snapshot().ideas.find(idea => idea.id === 'CF-107')?.status).toBe('screened');
    } finally { await engine.stop(); }
  });
});
