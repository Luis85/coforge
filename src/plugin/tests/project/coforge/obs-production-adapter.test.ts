import { describe, expect, it } from 'vitest';
import { ObsProductionAdapter } from '../../../infrastructure/coforge/obs-production-adapter';
import { PRODUCTION_REQUESTS } from '../../../infrastructure/coforge/obs-production-rpc';
import { ObsProductionServer } from '../../support/coforge/obs-production-server';

const kit = () => {
  const server = new ObsProductionServer();
  const adapter = new ObsProductionAdapter(server, server.snapshot, () => new Set(PRODUCTION_REQUESTS), server.context, server.secrets);
  return { server, adapter };
};
describe('OBS production adapter', () => {
  it('reads supported input/audio/output/video state without reading stream keys', async () => {
    const { server, adapter } = kit();
    const state = await adapter.inspect();
    expect(state.inputs[0]).toMatchObject({ id: 'microphone', name: 'Microphone', audio: { muted: false, volumeDb: -6 } });
    expect(state.recording).toMatchObject({ active: false, paused: false });
    expect(state.video?.baseWidth).toBe(1920);
    expect(server.requests.map(row => row.type)).not.toContain('GetStreamServiceSettings');
    expect(JSON.stringify(state)).not.toContain('private-stream-key');
  });
  it('sets mute and volume with readback, and treats a lost confirmation as uncertain', async () => {
    const { server, adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'input-mute', inputId: 'microphone', muted: true, expected: state.context });
    expect(state.inputs[0]?.audio.muted).toBe(true);
    state = await adapter.execute({ kind: 'input-volume', inputId: 'microphone', volumeDb: -12, expected: state.context });
    expect(state.inputs[0]?.audio.volumeDb).toBe(-12);
    server.ignoreMutation = true;
    await expect(adapter.execute({ kind: 'input-mute', inputId: 'microphone', muted: false, expected: state.context })).rejects.toMatchObject({ kind: 'uncertain' });
  }, 15000);
  it('rejects stale socket/collection/revision and unavailable requests before mutations', async () => {
    const { server, adapter } = kit();
    const state = await adapter.inspect();
    server.revision++;
    await expect(adapter.execute({ kind: 'record-start', expected: state.context })).rejects.toMatchObject({ kind: 'validation' });
    expect(server.requests.some(row => row.type === 'StartRecord')).toBe(false);
    const unsupported = new ObsProductionAdapter(server, server.snapshot, () => new Set(), server.context, server.secrets);
    await expect(unsupported.execute({ kind: 'record-start', expected: server.context() })).rejects.toMatchObject({ kind: 'validation' });
  });
  it('controls recording/replay/camera independently without ever broadcasting', async () => {
    const { server, adapter } = kit();
    let state = await adapter.inspect();
    for (const kind of ['record-start', 'record-pause', 'record-resume', 'record-stop', 'replay-start', 'replay-save', 'replay-stop', 'virtual-camera-start', 'virtual-camera-stop'] as const)
      state = await adapter.execute({ kind, expected: state.context });
    expect(state.recording?.active).toBe(false);
    expect(state.lastRecording).toBe('C:/Recordings/test.mkv');
    expect(state.lastReplay).toBe('C:/Recordings/replay.mkv');
    expect(server.requests.map(row => row.type)).not.toContain('StartStream');
  });
  it('uses Studio Mode preview and explicit transition without direct program switching', async () => {
    const { adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'studio-mode', enabled: true, expected: state.context });
    state = await adapter.execute({ kind: 'preview-scene', sceneId: 'break', expected: state.context });
    expect(state.broadcast.programSceneId).toBe('game');
    state = await adapter.execute({ kind: 'transition', name: 'Fade', duration: 300, expected: state.context });
    expect(state.broadcast.programSceneId).toBe('break');
  });
  it('writes destination credentials only from secret storage and refuses active-output setup', async () => {
    const { server, adapter } = kit();
    await adapter.saveOutputSecret('coforge-obs-output-stream-key', 'private-stream-key');
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'stream-service', service: 'Twitch', server: 'auto', keySecret: 'coforge-obs-output-stream-key', expected: state.context });
    expect(server.destination?.streamServiceSettings).toMatchObject({ service: 'Twitch', key: 'private-stream-key' });
    expect(JSON.stringify(state)).not.toContain('private-stream-key');
    server.active = true;
    await expect(adapter.execute({ kind: 'video-settings', video: state.video!, expected: server.context() })).rejects.toMatchObject({ kind: 'validation' });
  });
  it('bounds screenshot data and never returns a fabricated live-video frame', async () => {
    const { server, adapter } = kit();
    expect(await adapter.frame('game')).toMatchObject({ sceneId: 'game', kind: 'screenshot', dataUrl: 'data:image/png;base64,aGVsbG8=' });
    server.frame = 'data:text/html;base64,bm9wZQ==';
    await expect(adapter.frame('game')).rejects.toMatchObject({ kind: 'service' });
  });
  it('waits for asynchronous recording state without repeating the start request', async () => {
    const { server, adapter } = kit();
    const request = server.request.bind(server);
    server.request = async (type, data) => {
      const response = await request(type, data);
      if (type === 'StartRecord') { server.recording = false; setTimeout(() => { server.recording = true; }, 40); }
      return response;
    };
    const state = await adapter.inspect();
    expect((await adapter.execute({ kind: 'record-start', expected: state.context })).recording?.active).toBe(true);
    expect(server.requests.filter(row => row.type === 'StartRecord')).toHaveLength(1);
  });
  it('rejects credential-bearing ingest URLs and unrelated secret references before destination writes', async () => {
    const { server, adapter } = kit();
    await adapter.saveOutputSecret('coforge-obs-output-stream-key', 'private-stream-key');
    const state = await adapter.inspect();
    for (const serverUrl of ['rtmps://user:password@example.com/live', 'https://example.com/live', 'rtmps://example.com/live?key=secret']) {
      await expect(adapter.execute({ kind: 'stream-service', service: 'Custom', server: serverUrl, keySecret: 'coforge-obs-output-stream-key', expected: state.context })).rejects.toMatchObject({ kind: 'validation' });
    }
    await expect(adapter.execute({ kind: 'stream-service', service: 'Twitch', server: 'auto', keySecret: 'coforge-twitch-token', expected: state.context })).rejects.toMatchObject({ kind: 'validation' });
    expect(server.requests.some(row => row.type === 'SetStreamServiceSettings')).toBe(false);
  });
  it('controls monitoring, sync and track routing with observed readback', async () => {
    const { adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'input-monitor', inputId: 'microphone', monitor: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', expected: state.context });
    state = await adapter.execute({ kind: 'input-sync', inputId: 'microphone', syncOffset: 125, expected: state.context });
    state = await adapter.execute({ kind: 'input-tracks', inputId: 'microphone', tracks: { '1': true, '2': true }, expected: state.context });
    expect(state.inputs[0]?.audio).toMatchObject({ monitor: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', syncOffset: 125, tracks: { '1': true, '2': true } });
  });
  it('takes a fixed Cut transition without sending an unsupported duration write', async () => {
    const { server, adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'studio-mode', enabled: true, expected: state.context });
    state = await adapter.execute({ kind: 'preview-scene', sceneId: 'break', expected: state.context });
    state = await adapter.execute({ kind: 'transition', name: 'Cut', duration: 300, expected: state.context });
    expect(state.broadcast.programSceneId).toBe('break');
    expect(server.requests.some(row => row.type === 'SetCurrentSceneTransitionDuration')).toBe(false);
  });
});
