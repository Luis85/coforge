import { expect, it, vi } from 'vitest';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { StudioService } from '../../../features/coforge/application/studio';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { ConfiguredWorkflowEngine } from '../../../features/coforge/application/configured-workflow-engine';
import { workflowDefinitionCheck, defaultWorkflowDefinition, serializeWorkflowDefinition, parseWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { createSeed, defaultSettings, defaultIntegration } from '../../../features/coforge/domain/seed';
import { initialProject } from '../../../features/coforge/domain/projects';
import { MemoryStorage, nodeTimers } from './memory-storage';
import { ai } from './configured-workflow-fixture';

it('persists an explicit Play startup preference and defaults legacy workflows to Paused', async () => {
  const workflow = workflowDefinitionCheck({ ...defaultWorkflowDefinition(defaultSettings()), startupMode: 'play' });
  expect(parseWorkflowDefinition(serializeWorkflowDefinition(workflow))).toMatchObject({ startupMode: 'play' });
  const state = createSeed(); state.settings.workflow = workflow; state.settings.paused = true;
  const store = new StudioStore(new MemoryStorage(state)); await store.init();
  expect(store.snapshot().settings.paused).toBe(false);
  const legacy = createSeed(); legacy.settings.paused = false;
  const oldStore = new StudioStore(new MemoryStorage(legacy)); await oldStore.init();
  expect(oldStore.snapshot().settings.paused).toBe(true);
  expect(() => workflowDefinitionCheck({ ...workflow, startupMode: 'unknown' })).toThrow();
});

it('applies startup choices independently and keeps unavailable projects paused', async () => {
  const at = new Date().toISOString();
  const state = createSeed();
  const first = initialProject({ ...state.settings, workflow: workflowDefinitionCheck({ ...defaultWorkflowDefinition(state.settings), startupMode: 'play' }) }, defaultIntegration(), at);
  const second = { ...initialProject(defaultSettings(), defaultIntegration(), at), id: 'CFP-002' };
  const unavailable = { ...first, id: 'CFP-003', unavailable: true };
  state.projects = [first, second, unavailable]; state.activeProjectId = first.id; state.nextProjectNumber = 4;
  const store = new StudioStore(new MemoryStorage(state)); await store.init();
  expect(store.snapshot().projects?.map(project => project.settings.paused)).toEqual([false, true, true]);
});

it('does not replay an interrupted attempt when Play is selected for startup', async () => {
  const state = createSeed();
  state.ideas = state.ideas.filter(idea => idea.status === 'inbox').slice(0, 1); state.jobs = [];
  state.settings.workflow = workflowDefinitionCheck({ ...defaultWorkflowDefinition(state.settings), startupMode: 'play', steps: [ai('analysis')] });
  const store = new StudioStore(new MemoryStorage(state)); await store.init();
  const runner = vi.fn(async () => ({ markdown: '# Answer' }));
  const configured = new ConfiguredWorkflowEngine(store, { runners: { demo: runner, claude: runner }, cost: async () => {}, usage: async () => {} });
  const ideaId = store.snapshot().ideas[0]!.id;
  await configured.start(ideaId);
  const interrupted = store.snapshot();
  expect(interrupted.jobs.some(job => job.status === 'queued')).toBe(true);
  const restarted = new StudioStore(new MemoryStorage(interrupted)); await restarted.init();
  const engine = new WorkflowEngine(restarted, { runners: { demo: runner, claude: runner }, timers: nodeTimers() });
  try {
    expect(restarted.snapshot().settings.paused).toBe(false);
    expect(restarted.snapshot().ideas[0]?.workflowRun?.state).toBe('attention');
    expect(await engine.tick(false)).toBeNull();
    await engine.waitUntilIdle();
    expect(runner).not.toHaveBeenCalled();
    expect(restarted.snapshot().jobs.every(job => job.status === 'failed')).toBe(true);
  } finally { await engine.stop(); await configured.dispose(); }
});

it('defers automatic dispatch until the host explicitly starts its ready engine', async () => {
  vi.useFakeTimers();
  const state = createSeed();
  state.ideas = state.ideas.filter(idea => idea.status === 'inbox').slice(0, 1); state.jobs = [];
  state.settings.workflow = workflowDefinitionCheck({ ...defaultWorkflowDefinition(state.settings), startupMode: 'play', steps: [ai('analysis')] });
  const runner = vi.fn(async () => ({ markdown: '# Answer' }));
  const studio = new StudioService(new MemoryStorage(state), { runners: { demo: runner, claude: runner }, timers: nodeTimers(), probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  try {
    await studio.start({ deferAutomation: true });
    expect(studio.state().settings.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(runner).not.toHaveBeenCalled();
    studio.engine.start();
    await vi.advanceTimersByTimeAsync(750);
    await studio.engine.waitUntilIdle();
    expect(runner).toHaveBeenCalledTimes(1);
  } finally { await studio.stop(); vi.useRealTimers(); }
});
