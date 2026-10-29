import { afterEach, describe, expect, it } from 'vitest';
import { ObsShowWorkflow } from '../../../features/coforge/application/obs-show-workflow';
import type { ObsShowPlan, ObsShowStep } from '../../../features/coforge/domain/obs-show';
import { IntegrationFailure } from '../../../features/coforge/domain/integration-failure';
import { emptyStore } from './memory-storage';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { ObsShowProductionExecutor } from '../../../features/coforge/application/obs-show-executor';
const workflows: ObsShowWorkflow[] = [];
afterEach(() => { for (const workflow of workflows.splice(0)) workflow.dispose(); });

const plan: ObsShowPlan = {
  id: 'show', name: 'Friday development',
  segments: [{ id: 'development', name: 'Development', note: 'Introduce the selected task', durationSeconds: 1200,
    steps: [{ kind: 'scene', sceneId: 'development' }, { kind: 'mute', inputId: 'mic', muted: false }] }],
  bindings: [{ id: 'start', event: 'stream-started', cueId: 'development', enabled: true }],
};
async function kit() {
  const { store, storage } = await emptyStore();
  const calls: ObsShowStep[] = [];
  const workflow = new ObsShowWorkflow(store, { execute: async step => {
    expect(store.snapshot().obsShow?.run?.steps[calls.length]?.status).toBe('pending');
    calls.push(step);
  }, live: () => true });
  workflows.push(workflow);
  await workflow.start();
  await workflow.savePlan(plan);
  return { store, storage, calls, workflow };
}
describe('OBS show production', () => {
  it('captures and journals each cue step before effects and retains exact plan across reload', async () => {
    const app = await kit();
    await app.workflow.runCue('show', 'development');
    expect(app.calls).toEqual(plan.segments[0]!.steps);
    expect(app.workflow.snapshot().run).toMatchObject({ status: 'confirmed', planId: 'show', cueId: 'development' });
    expect(app.workflow.snapshot().run?.steps.map(step => step.status)).toEqual(['confirmed', 'confirmed']);
    expect((await app.storage.load()).data?.obsShow?.plans).toEqual([plan]);
    expect(parsePersistedStudio((await app.storage.load()).data).obsShow?.plans).toEqual([plan]);
    expect(app.workflow.snapshot().automationEnabled).toBe(false);
  });
  it('preserves definitions on failed save and issues no cue effect when intent cannot persist', async () => {
    const app = await kit();
    app.storage.failNextSave = true;
    await expect(app.workflow.savePlan({ ...plan, name: 'Changed' })).rejects.toThrow();
    expect(app.workflow.snapshot().plans[0]?.name).toBe(plan.name);
    app.storage.failNextSave = true;
    await expect(app.workflow.runCue('show', 'development')).rejects.toThrow();
    expect(app.calls).toEqual([]);
  });
  it('holds partial uncertain results, blocks new cues and acknowledges without replay', async () => {
    const app = await kit();
    app.workflow.dispose();
    let count = 0;
    const workflow = new ObsShowWorkflow(app.store, { live: () => true, execute: async () => {
      if (++count === 2) throw new IntegrationFailure('uncertain', 'Response lost');
    } });
    workflows.push(workflow);
    await workflow.start();
    await expect(workflow.runCue('show', 'development')).rejects.toThrow();
    expect(workflow.snapshot().run?.status).toBe('uncertain');
    expect(workflow.snapshot().run?.steps.map(step => step.status)).toEqual(['confirmed', 'uncertain']);
    await expect(workflow.runCue('show', 'development')).rejects.toThrow();
    await workflow.recover();
    expect(count).toBe(2);
    expect(workflow.snapshot().run?.status).toBe('acknowledged');
  });
  it('pauses automation on startup, deduplicates live events and ignores old or offline events', async () => {
    const app = await kit();
    await app.workflow.handleEvent('stream-started', 12);
    expect(app.calls).toEqual([]);
    await app.workflow.setAutomation(true);
    await app.workflow.handleEvent('stream-started', 13);
    await app.workflow.handleEvent('stream-started', 13);
    expect(app.calls).toHaveLength(2);
    app.workflow.dispose();
    const reloaded = new ObsShowWorkflow(app.store, { execute: async step => { app.calls.push(step); }, live: () => true });
    workflows.push(reloaded);
    await reloaded.start();
    expect(reloaded.snapshot().automationEnabled).toBe(false);
    expect(app.calls).toHaveLength(2);
    await reloaded.setAutomation(true);
    await reloaded.handleEvent('stream-started', 12);
    expect(app.calls).toHaveLength(2);
  });
  it('rejects invalid or oversized plans and concurrent mutations without replacing the draft', async () => {
    const app = await kit();
    await expect(app.workflow.savePlan({ ...plan, segments: [{ ...plan.segments[0], steps: [{ kind: 'go-live' }] }] })).rejects.toThrow();
    await expect(app.workflow.savePlan({ ...plan, bindings: [{ id: 'missing', event: 'stream-started', cueId: 'missing', enabled: true }] })).rejects.toThrow();
    expect(app.workflow.snapshot().plans).toEqual([plan]);
    let release = () => {};
    const waiting = new Promise<void>(resolve => { release = resolve; });
    app.workflow.dispose();
    const workflow = new ObsShowWorkflow(app.store, { live: () => true, execute: () => waiting });
    workflows.push(workflow);
    await workflow.start();
    const first = workflow.runCue('show', 'development');
    await expect(workflow.runCue('show', 'development')).rejects.toThrow();
    release();
    await first;
  });
  it('holds interrupted cues across restart without another action and captures timer duration', async () => {
    const app = await kit();
    await app.workflow.runCue('show', 'development');
    await app.store.transaction(state => {
      if (state.obsShow?.run) { state.obsShow.run.status = 'running'; state.obsShow.run.steps[1]!.status = 'pending'; }
    });
    await app.workflow.start();
    expect(app.workflow.snapshot().run).toMatchObject({ status: 'uncertain', durationSeconds: 1200 });
    expect(app.workflow.snapshot().run?.steps[1]?.status).toBe('uncertain');
    expect(app.calls).toHaveLength(2);
    await expect(app.workflow.runCue('show', 'development')).rejects.toThrow();
  });
  it('runs an explicit stopped-event cue only with an observed ready connection and skips offline events', async () => {
    const app = await kit(); app.workflow.dispose();
    const calls: ObsShowStep[] = [];
    let ready = false;
    const workflow = new ObsShowWorkflow(app.store, { execute: async step => { calls.push(step); }, live: () => false, ready: () => ready });
    workflows.push(workflow);
    await workflow.start();
    await workflow.savePlan({ ...plan, bindings: [{ id: 'end', event: 'stream-stopped', cueId: 'development', enabled: true }] });
    await workflow.setAutomation(true);
    await workflow.handleEvent('stream-stopped', 100);
    expect(calls).toEqual([]);
    expect(workflow.snapshot().lastTrigger?.reason).toBe('offline');
    ready = true;
    await workflow.handleEvent('stream-stopped', 101);
    expect(calls).toHaveLength(2);
  });
  it('bounds enabled event fanout before saving any replacement plan', async () => {
    const app = await kit();
    const bindings = Array.from({ length: 11 }, (_, index) => ({ ...plan.bindings[0]!, id: `binding-${index}` }));
    await expect(app.workflow.savePlan({ ...plan, bindings })).rejects.toThrow('at most ten');
    expect(app.workflow.snapshot().plans).toEqual([plan]);
  });
  it('persists approved overlay mappings and captures only the selected mapping ID in cue steps', async () => {
    const app = await kit();
    const mapping = { id: 'public-council', name: 'Council excerpt', kind: 'council-excerpt' as const, inputId: 'caption', projectId: 'CFP-001', excerpt: 'Explicitly reviewed public excerpt', publicConfirmed: true };
    await app.store.transaction(state => { if (state.obsShow) state.obsShow.overlays = [mapping]; });
    await app.workflow.savePlan({ ...plan, segments: [{ ...plan.segments[0]!, steps: [{ kind: 'overlay', overlayId: mapping.id }] }] });
    await app.workflow.runCue('show', 'development');
    expect(app.calls).toEqual([{ kind: 'overlay', overlayId: mapping.id }]);
    expect(parsePersistedStudio((await app.storage.load()).data).obsShow?.overlays).toEqual([mapping]);
    expect(JSON.stringify(app.store.snapshot().population?.operations)).not.toContain(mapping.excerpt);
  });
  it('routes an overlay cue through its public refresh policy and rejects a missing publisher without raw OBS effects', async () => {
    const calls: string[] = [];
    const production = { inspect: async () => { throw new Error('Overlay policy owns inspection'); }, execute: async () => { throw new Error('Overlay policy owns effects'); } };
    const scenes = { execute: async () => { throw new Error('Overlay policy owns effects'); } };
    const executor = new ObsShowProductionExecutor(production, scenes, () => true, () => true, async () => {}, async id => { calls.push(id); });
    await executor.execute({ kind: 'overlay', overlayId: 'public-council' });
    expect(calls).toEqual(['public-council']);
    const unavailable = new ObsShowProductionExecutor(production, scenes, () => true);
    await expect(unavailable.execute({ kind: 'overlay', overlayId: 'public-council' })).rejects.toThrow('unavailable');
  });
  it('runs an explicitly enabled music-change overlay cue while on air', async () => {
    const app = await kit();
    await app.workflow.savePlan({ ...plan, segments: [{ ...plan.segments[0]!, steps: [{ kind: 'overlay', overlayId: 'now-playing' }] }],
      bindings: [{ id: 'track-start', event: 'music-playback-started', cueId: 'development', enabled: true }] });
    await app.workflow.handleEvent('music-playback-started', 100);
    expect(app.calls).toEqual([]);
    await app.workflow.setAutomation(true);
    await app.workflow.handleEvent('music-playback-started', 101);
    expect(app.calls).toEqual([{ kind: 'overlay', overlayId: 'now-playing' }]);
    app.workflow.dispose();
  });
});
