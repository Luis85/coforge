import { afterEach, describe, expect, it } from 'vitest';
import { ObsSetupWorkflow } from '../../../features/coforge/application/obs-setup-workflow';
import type { ObsProductionActions } from '../../../features/coforge/application/obs-production-workflow';
import type { ObsProductionSnapshot } from '../../../features/coforge/domain/obs-production';
import type { ObsSceneActions, ObsSceneDetail } from '../../../features/coforge/domain/obs-scenes';
import type { ObsSetupInput } from '../../../features/coforge/domain/obs-setup';
import { record } from '../../../features/coforge/domain/check';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { emptyStore } from './memory-storage';
const workflows: ObsSetupWorkflow[] = [];
afterEach(() => { for (const workflow of workflows.splice(0)) workflow.dispose(); });

const draft: ObsSetupInput = { prefix: 'CoForge', sources: [{ name: 'Microphone', inputKind: 'wasapi_input_capture', settings: { device_id: 'default' }, roles: ['development', 'brb'], enabled: true }] };
async function kit() {
  const { store, storage } = await emptyStore();
  const calls: string[] = [];
  const snapshot: ObsProductionSnapshot = {
    context: { epoch: 1, collection: 0, revision: 0 }, observedAt: new Date().toISOString(),
    broadcast: { epoch: 1, revision: 1, scenes: [], programSceneId: null, active: false, reconnecting: false, transitioning: false, timecode: '', observedAt: new Date().toISOString() },
    available: ['input-create', 'video-settings'], inputKinds: ['wasapi_input_capture'], filterKinds: [], inputs: [], studioMode: false, outputActivity: false,
    transitions: [], transition: null, recording: null, replayBuffer: null, virtualCamera: null, video: null, recordDirectory: null, lastRecording: null, lastReplay: null,
  };
  const detail = (sceneId: string): ObsSceneDetail => ({ sceneId, name: sceneId, context: snapshot.context, items: [],
    sources: snapshot.inputs.map(input => ({ id: `input:${input.id}`, name: input.name, kind: 'input' })), available: ['scene-create', 'item-add'], observedAt: snapshot.observedAt });
  const scenes: ObsSceneActions = {
    inspect: async sceneId => detail(sceneId), execute: async value => {
      expect(store.snapshot().obsSetup?.pendingStep).toBeTruthy();
      const action = record(value); calls.push(String(action.kind));
      if (action.kind === 'scene-create' && typeof action.name === 'string') snapshot.broadcast.scenes.push({ id: action.name, name: action.name });
      if (action.kind === 'scene-switch' && typeof action.sceneId === 'string') snapshot.broadcast.programSceneId = action.sceneId;
      return { snapshot: snapshot.broadcast, detail: null };
    },
  };
  const production: ObsProductionActions = {
    inspect: async () => structuredClone(snapshot), execute: async value => {
      expect(store.snapshot().obsSetup?.pendingStep).toBeTruthy();
      const action = record(value); calls.push(String(action.kind));
      if (action.kind === 'input-create' && typeof action.name === 'string' && typeof action.inputKind === 'string') snapshot.inputs.push({ id: action.name, name: action.name, kind: action.inputKind, settings: {},
        audio: { muted: false, volumeDb: 0, monitor: null, syncOffset: 0, tracks: null, peakDb: null, meterObservedAt: null } });
      return structuredClone(snapshot);
    }, frame: async () => { throw new Error('Unused'); }, properties: async () => [], transform: async () => { throw new Error('Unused'); }, filters: async () => [], saveOutputSecret: async () => undefined, acknowledgeOutputRestart: async () => structuredClone(snapshot),
  };
  const workflow = new ObsSetupWorkflow(store, production, scenes, { configure: async input => {
    const settings = record(input); calls.push('configure');
    expect(settings.liveSceneId).toBe('CoForge · Development'); expect(settings.breakSceneId).toBe('CoForge · BRB');
  } });
  workflows.push(workflow);
  await workflow.start();
  return { store, storage, calls, snapshot, workflow, production };
}
describe('Create my OBS studio', () => {
  it('previews exact starter scenes, then creates reviewed scenes and shared sources without broadcasting', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(draft);
    expect(preview.scenes).toHaveLength(6);
    expect(app.calls).toEqual([]);
    const result = await app.workflow.apply({ previewId: preview.id, confirmed: true });
    expect(result.state.status).toBe('confirmed');
    expect(app.calls).toEqual([...Array<string>(6).fill('scene-create'), 'input-create', 'item-add', 'configure', 'scene-switch']);
    expect(result.state.completed).toHaveLength(result.state.total);
    expect(app.snapshot.broadcast.active).toBe(false);
    expect(app.snapshot.broadcast.programSceneId).toBe('CoForge · Development');
    expect(parsePersistedStudio((await app.storage.load()).data).obsSetup?.status).toBe('confirmed');
  });
  it('requires an explicit current preview and rejects changed connection or colliding source names', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(draft);
    await expect(app.workflow.apply({ previewId: preview.id, confirmed: false })).rejects.toThrow();
    app.snapshot.context.epoch++;
    await expect(app.workflow.apply({ previewId: preview.id, confirmed: true })).rejects.toThrow();
    expect(app.calls).toEqual([]);
    await expect(app.workflow.preview({ ...draft, sources: [draft.sources[0], draft.sources[0]] })).rejects.toThrow();
  });
  it('retains completed steps after interrupted setup and never retries effects on reload/recovery', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(draft);
    app.production.execute = async () => { app.calls.push('input-create'); throw new Error('Socket closed'); };
    await expect(app.workflow.apply({ previewId: preview.id, confirmed: true })).rejects.toThrow();
    expect(app.workflow.snapshot()?.status).toBe('uncertain');
    expect(app.workflow.snapshot()?.completed).toHaveLength(6);
    await app.workflow.start();
    await app.workflow.recover();
    expect(app.calls.filter(kind => kind === 'input-create')).toHaveLength(1);
    expect(app.workflow.snapshot()?.status).toBe('acknowledged');
  });
  it('does not mutate OBS when saving setup intent fails or the stream is on air', async () => {
    const app = await kit();
    const preview = await app.workflow.preview(draft);
    app.storage.failNextSave = true;
    await expect(app.workflow.apply({ previewId: preview.id, confirmed: true })).rejects.toThrow();
    expect(app.calls).toEqual([]);
    app.snapshot.broadcast.active = true;
    await expect(app.workflow.preview(draft)).rejects.toThrow();
  });
  it('blocks active or unobserved outputs and stops follow-on setup actions after unload', async () => {
    const app = await kit();
    app.snapshot.outputActivity = null;
    await expect(app.workflow.preview(draft)).rejects.toThrow();
    app.snapshot.outputActivity = false;
    app.snapshot.virtualCamera = { active: true, paused: false, timecode: '' };
    await expect(app.workflow.preview(draft)).rejects.toThrow();
    app.snapshot.virtualCamera.active = false;
    const preview = await app.workflow.preview(draft);
    app.production.execute = async () => { app.calls.push('input-create'); app.workflow.dispose(); return structuredClone(app.snapshot); };
    await expect(app.workflow.apply({ previewId: preview.id, confirmed: true })).rejects.toThrow();
    expect(app.calls).not.toContain('configure');
    expect(app.calls.filter(kind => kind === 'input-create')).toHaveLength(1);
    await expect(app.workflow.preview(draft)).rejects.toThrow();
  });
});
