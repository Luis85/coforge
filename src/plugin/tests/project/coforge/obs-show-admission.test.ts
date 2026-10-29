import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObsWorkflow } from '../../../features/coforge/application/obs-workflow';
import { ObsShowWorkflow } from '../../../features/coforge/application/obs-show-workflow';
import type { ObsControlPort } from '../../../features/coforge/application/obs-port';
import type { ObsSnapshot } from '../../../features/coforge/domain/obs';
import { sceneContext } from '../../../features/coforge/domain/obs-scenes';
import { emptyStore } from './memory-storage';
const services: Array<{ dispose(): void }> = [];
afterEach(() => { for (const service of services.splice(0)) service.dispose(); });

describe('stream completion cue admission', () => {
  it('runs a stream-started cue after the triggering broadcast command releases shared admission', async () => {
    const { store } = await emptyStore();
    const snapshot: ObsSnapshot = { epoch: 1, revision: 1, scenes: [{ id: 'live', name: 'Development' }, { id: 'council', name: 'Council' }],
      programSceneId: 'live', active: false, reconnecting: false, transitioning: false, timecode: '', observedAt: new Date().toISOString() };
    const calls: string[] = [];
    const read = async () => structuredClone(snapshot);
    const control: ObsControlPort = {
      connect: read, open: read, snapshot: read, disconnect: () => {}, dispose: () => {}, savePassword: async () => {}, subscribe: () => () => {},
      detect: async () => ({ status: 'running', running: true, passwordSaved: true }),
      selectScene: async id => { snapshot.programSceneId = id; calls.push(`scene:${id}`); return read(); },
      startStream: async () => { snapshot.active = true; calls.push('start'); return read(); },
      stopStream: async () => { snapshot.active = false; calls.push('stop'); return read(); },
      scenes: { inspect: async () => { throw new Error('Unused'); }, execute: async action => {
        expect(store.snapshot().runtime.obs?.busy).toBe(true);
        if (action.kind !== 'scene-switch') throw new Error('Unexpected action');
        snapshot.programSceneId = action.sceneId; calls.push(`scene:${action.sceneId}`);
        return { snapshot: await read(), detail: null };
      } },
    };
    const obs = new ObsWorkflow(store, control); obs.start();
    services.push(obs);
    await obs.configure({ liveSceneId: 'live', breakSceneId: '' }); await obs.connect();
    const ready = () => Boolean(store.snapshot().runtime.obs?.connection === 'connected' && !store.snapshot().runtime.obs?.busy);
    const show = new ObsShowWorkflow(store, {
      ready, live: () => ready() && snapshot.active,
      settle: () => obs.afterCurrentInteraction(),
      execute: async step => {
        if (step.kind !== 'scene') throw new Error('Unexpected step');
        await obs.sceneActions!.execute({ kind: 'scene-switch', sceneId: step.sceneId, expected: sceneContext(snapshot) });
      },
    });
    services.push(show);
    await show.start();
    await show.savePlan({ id: 'show', name: 'Show', segments: [{ id: 'intro', name: 'Council introduction', note: '', durationSeconds: 60, steps: [{ kind: 'scene', sceneId: 'council' }] }],
      bindings: [{ id: 'onstart', event: 'stream-started', cueId: 'intro', enabled: true }] });
    await show.setAutomation(true); await obs.prepare(); await obs.goLive();
    await vi.waitFor(() => expect(show.snapshot().run?.status).toBe('confirmed'));
    expect(calls).toEqual(['start', 'scene:council']);
    expect(store.snapshot().population?.counters['stream-control-rejected']).toBeUndefined();
    await store.transaction(state => { if (state.obsShow) state.obsShow.outputRestartRequired = true; });
    await expect(obs.prepare()).rejects.toThrow('Restart OBS');
    expect(store.snapshot().runtime.obs?.busy).toBe(false);
    show.dispose(); obs.dispose();
  });
  it('does not revive a waiting event cue after disposal', async () => {
    const { store } = await emptyStore(); let release = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    const execute = vi.fn(async () => {});
    const show = new ObsShowWorkflow(store, { execute, live: () => true, settle: () => pending });
    services.push(show);
    await show.start();
    await show.savePlan({ id: 'show', name: 'Show', segments: [{ id: 'cue', name: 'Cue', note: '', durationSeconds: 0, steps: [{ kind: 'scene', sceneId: 'live' }] }],
      bindings: [{ id: 'event', event: 'stream-started', cueId: 'cue', enabled: true }] });
    await show.setAutomation(true);
    const event = show.handleEvent('stream-started', 100);
    await store.flush(); show.dispose(); release(); await event;
    expect(execute).not.toHaveBeenCalled();
  });
  it('does not run an older waiting stream event after a newer event was skipped during admission', async () => {
    const { store } = await emptyStore(); let release = () => {};
    const pending = new Promise<void>(resolve => { release = resolve; });
    const execute = vi.fn(async () => {});
    const show = new ObsShowWorkflow(store, { execute, live: () => true, settle: () => pending });
    services.push(show);
    await show.start();
    await show.savePlan({ id: 'show', name: 'Show', segments: [{ id: 'cue', name: 'Cue', note: '', durationSeconds: 0, steps: [{ kind: 'scene', sceneId: 'live' }] }],
      bindings: [{ id: 'event', event: 'stream-started', cueId: 'cue', enabled: true }] });
    await show.setAutomation(true);
    const older = show.handleEvent('stream-started', 100);
    await store.flush();
    await show.handleEvent('stream-started', 101);
    release(); await older;
    expect(execute).not.toHaveBeenCalled();
    expect(show.snapshot().lastTrigger).toMatchObject({ sequence: 101, reason: 'busy' });
    show.dispose();
  });
});
