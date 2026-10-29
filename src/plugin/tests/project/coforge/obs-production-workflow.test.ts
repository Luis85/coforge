import { describe, expect, it } from 'vitest';
import { ObsProductionWorkflow } from '../../../features/coforge/application/obs-production-workflow';
import type { ObsProductionPort } from '../../../features/coforge/application/obs-production-port';
import type { ObsProductionSnapshot } from '../../../features/coforge/domain/obs-production';
import { IntegrationFailure } from '../../../features/coforge/domain/integration-failure';
import { emptyStore } from './memory-storage';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';

export const productionSnapshot = (): ObsProductionSnapshot => ({
  context: { epoch: 1, collection: 0, revision: 0 }, observedAt: new Date().toISOString(),
  broadcast: { epoch: 1, revision: 1, scenes: [{ id: 'dev', name: 'Development' }], programSceneId: 'dev', active: false,
    reconnecting: false, transitioning: false, timecode: '', observedAt: new Date().toISOString() },
  available: ['input-mute', 'record-start', 'video-settings'], inputKinds: [], filterKinds: [], inputs: [], studioMode: false, outputActivity: false,
  transitions: [], transition: null, recording: null, replayBuffer: null, virtualCamera: null, video: null,
  recordDirectory: null, lastRecording: null, lastReplay: null,
});
async function kit() {
  const { store, storage } = await emptyStore();
  const snapshot = productionSnapshot();
  const calls: string[] = [];
  let uncertain = false;
  let busy = false;
  const port: ObsProductionPort = {
    inspect: async () => snapshot,
    execute: async action => {
      expect(store.obsContext().command).toMatchObject({ kind: 'production', status: 'pending' });
      calls.push(action.kind); return snapshot;
    },
    frame: async sceneId => ({ sceneId, kind: 'screenshot', dataUrl: 'data:image/png;base64,AAAA', observedAt: snapshot.observedAt }),
    properties: async () => [], transform: async () => ({ positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0,
      cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, boundsType: 'OBS_BOUNDS_NONE', boundsWidth: 0, boundsHeight: 0, alignment: 5 }),
    filters: async () => [], saveOutputSecret: async () => { calls.push('secret'); },
  };
  const workflow = new ObsProductionWorkflow(store, port, {
    claim: async () => { if (busy) throw new IntegrationFailure('validation', 'Busy'); busy = true; },
    release: async () => { busy = false; }, fresh: async () => snapshot.broadcast, accept: async () => undefined,
    uncertain: () => uncertain, invalidate: () => undefined, failed: (_message, unknown) => { uncertain = unknown; },
  });
  return { store, storage, snapshot, calls, port, workflow };
}
describe('OBS production application boundary', () => {
  it('journals before effects, exposes observed status and keeps screenshots out of durable state', async () => {
    const app = await kit();
    await app.workflow.execute({ kind: 'input-mute', inputId: 'mic', muted: true, expected: app.snapshot.context });
    expect(app.calls).toEqual(['input-mute']);
    expect(app.store.obsContext().command?.status).toBe('confirmed');
    expect(app.store.snapshot().runtime.obsProduction).toEqual(app.snapshot);
    await app.workflow.frame('dev');
    expect(JSON.stringify((await app.storage.load()).data)).not.toContain('data:image');
  });
  it('rejects malformed/stale/unsupported actions and missing intent persistence before effects', async () => {
    const app = await kit();
    for (const value of [
      { kind: 'input-mute', inputId: 'mic', muted: 'true', expected: app.snapshot.context },
      { kind: 'input-mute', inputId: 'mic', muted: true, expected: { ...app.snapshot.context, epoch: 99 } },
      { kind: 'record-stop', expected: app.snapshot.context },
    ]) await expect(app.workflow.execute(value)).rejects.toThrow();
    app.storage.failNextSave = true;
    await expect(app.workflow.execute({ kind: 'record-start', expected: app.snapshot.context })).rejects.toThrow();
    expect(app.calls).toEqual([]);
  });
  it('blocks further mutations after lost confirmation without repeating commands', async () => {
    const app = await kit();
    app.port.execute = async () => { app.calls.push('record-start'); throw new IntegrationFailure('uncertain', 'Lost response'); };
    await expect(app.workflow.execute({ kind: 'record-start', expected: app.snapshot.context })).rejects.toThrow();
    expect(app.store.obsContext().command?.status).toBe('uncertain');
    await expect(app.workflow.execute({ kind: 'record-start', expected: app.snapshot.context })).rejects.toThrow();
    expect(app.calls).toEqual(['record-start']);
  });
  it('writes output secrets without putting values in durable records or operation metadata', async () => {
    const app = await kit();
    await app.workflow.saveOutputSecret('coforge-obs-output-stream-key', 'private-stream-key');
    expect(app.calls).toEqual(['secret']);
    expect(JSON.stringify((await app.storage.load()).data)).not.toContain('private-stream-key');
    await expect(app.workflow.saveOutputSecret('coforge-twitch-account', 'private-stream-key')).rejects.toThrow();
    expect(app.calls).toEqual(['secret']);
  });
  it('retains only confirmed recording and replay file references across reload', async () => {
    const app = await kit();
    app.snapshot.available.push('record-stop', 'replay-save');
    app.port.execute = async action => ({ ...app.snapshot, ...(action.kind === 'record-stop' ? { lastRecording: 'C:/Recordings/show.mkv' } : { lastReplay: 'C:/Recordings/replay.mkv' }) });
    await app.workflow.execute({ kind: 'record-stop', expected: app.snapshot.context });
    await app.workflow.execute({ kind: 'replay-save', expected: app.snapshot.context });
    const saved = parsePersistedStudio((await app.storage.load()).data).obsShow?.outputFiles;
    expect(saved?.map(item => [item.kind, item.path])).toEqual([['recording', 'C:/Recordings/show.mkv'], ['replay', 'C:/Recordings/replay.mkv']]);
    expect(saved?.[0]).toMatchObject({ obsEpoch: 1, sceneId: 'dev', broadcastActive: false });
    expect(JSON.stringify(app.store.snapshot().population?.operations)).not.toContain('C:/Recordings');
  });
  it('retains output restart requirement across reconnect and requires explicit offair acknowledgement', async () => {
    const app = await kit();
    app.snapshot.available.push('output-preset');
    app.snapshot.outputPreset = { mode: 'Simple', videoBitrate: 4500, audioBitrate: 160, recordingQuality: 'HQ', recordingFormat: 'mkv', replayEnabled: true, replaySeconds: 30, status: 'observed' };
    await app.workflow.execute({ kind: 'output-preset', preset: 'balanced', replayEnabled: true, replaySeconds: 30, expected: app.snapshot.context });
    expect(app.store.snapshot().obsShow?.outputRestartRequired).toBe(true);
    expect((await app.workflow.inspect()).outputPreset?.status).toBe('saved-reload-required');
    app.snapshot.broadcast.active = true;
    await expect(app.workflow.acknowledgeOutputRestart()).rejects.toThrow();
    app.snapshot.broadcast.active = false;
    app.snapshot.recording = app.snapshot.replayBuffer = app.snapshot.virtualCamera = { active: false, paused: false, timecode: '' };
    await app.workflow.acknowledgeOutputRestart();
    expect(app.store.snapshot().obsShow?.outputRestartRequired).toBe(false);
  });
});
