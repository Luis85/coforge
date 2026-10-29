import { expect, it } from 'vitest';
import { ObsProductionSocketServer } from '../../../../../tooling/tests/obsidian/support/obs-production-socket';
import { ObsAdapter } from '../../../infrastructure/coforge/obs-adapter';
import { defaultObsSettings } from '../../../features/coforge/domain/obs';
import { nodeTimers } from './memory-storage';

it('runs a real v5 loopback socket from blank scenes through source/audio/recording without broadcasting', async () => {
  const server = new ObsProductionSocketServer();
  await server.start();
  const adapter = new ObsAdapter(url => new WebSocket(url, 'obswebsocket.json'), nodeTimers(), server.state.secrets);
  try {
    const connected = await adapter.connect({ ...defaultObsSettings(), endpoint: server.endpoint });
    expect(connected.scenes).toEqual([{ id: 'initial', name: 'Scene' }]);
    let state = await adapter.production.inspect();
    state = await adapter.production.execute({ kind: 'input-create', sceneId: 'initial', name: 'Local microphone', inputKind: 'wasapi_input_capture', enabled: true, settings: { device_id: 'default' }, expected: state.context });
    const input = state.inputs.find(input => input.name === 'Local microphone')!;
    state = await adapter.production.execute({ kind: 'input-mute', inputId: input.id, muted: true, expected: state.context });
    expect(state.inputs[0]?.audio.muted).toBe(true);
    state = await adapter.production.execute({ kind: 'record-start', expected: state.context });
    expect(state.recording?.active).toBe(true);
    state = await adapter.production.execute({ kind: 'record-stop', expected: state.context });
    expect(state.lastRecording).toBe('C:/Recordings/test.mkv');
    expect(server.state.requests.some(request => request.type === 'StartStream')).toBe(false);
  } finally { adapter.dispose(); await server.close(); }
}, 30000);
