import { describe, expect, it } from 'vitest';
import { ObsProductionAdapter } from '../../../infrastructure/coforge/obs-production-adapter';
import { PRODUCTION_REQUESTS } from '../../../infrastructure/coforge/obs-production-rpc';
import { ObsProductionServer } from '../../support/coforge/obs-production-server';
const kit = () => {
  const server = new ObsProductionServer();
  const adapter = new ObsProductionAdapter(server, server.snapshot, () => new Set(PRODUCTION_REQUESTS), server.context, server.secrets);
  return { server, adapter };
};
describe('OBS production source authoring', () => {
  it('creates a browser source, preserves unrelated settings and projects credential URLs safely', async () => {
    const { server, adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'input-create', name: 'Public requests', inputKind: 'browser_source', sceneId: 'game', settings: { url: 'https://example.com/board?token=private&view=public', width: 1280, height: 720 }, enabled: true, expected: state.context });
    const input = state.inputs.find(input => input.name === 'Public requests')!;
    expect(input.settings.url).toContain('%5Bredacted%5D');
    expect(input.settings.url).not.toContain('private');
    await expect(adapter.execute({ kind: 'input-settings', inputId: input.id, settings: { url: input.settings.url! }, expected: state.context })).rejects.toMatchObject({ kind: 'validation' });
    state = await adapter.execute({ kind: 'input-settings', inputId: input.id, settings: { width: 1920 }, expected: state.context });
    expect(server.inputSettings.get('Public requests')).toMatchObject({ height: 720, width: 1920 });
    expect(state.inputs.find(value => value.id === input.id)?.settings.width).toBe(1920);
    await expect(adapter.execute({ kind: 'input-settings', inputId: input.id, settings: { password: 'never-forward' }, expected: state.context })).rejects.toMatchObject({ kind: 'validation' });
  });
  it('reads device choices and confirms transforms and locks against the selected scene item', async () => {
    const { server, adapter } = kit();
    expect(await adapter.properties('microphone', 'device_id')).toEqual([{ label: 'Default device', value: 'default', enabled: true }]);
    const original = await adapter.transform('game', 1);
    expect(original.scaleX).toBe(1);
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'item-transform', sceneId: 'game', itemId: 1, transform: { positionX: 160, cropLeft: 20, scaleX: 0.5 }, expected: state.context });
    expect(await adapter.transform('game', 1)).toMatchObject({ positionX: 160, cropLeft: 20, scaleX: 0.5 });
    await adapter.execute({ kind: 'item-lock', sceneId: 'game', itemId: 1, locked: true, expected: state.context });
    expect(server.itemLocked).toBe(true);
  });
  it('creates, edits and removes a supported audio filter with exact target confirmation', async () => {
    const { adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'filter-create', inputId: 'microphone', filterName: 'Gain', filterKind: 'gain_filter', settings: { db: -3 }, expected: state.context });
    expect(await adapter.filters('microphone')).toEqual([{ name: 'Gain', kind: 'gain_filter', enabled: true, index: 0, settings: { db: -3 } }]);
    state = await adapter.execute({ kind: 'filter-settings', inputId: 'microphone', filterName: 'Gain', settings: { db: -9 }, expected: state.context });
    state = await adapter.execute({ kind: 'filter-enabled', inputId: 'microphone', filterName: 'Gain', enabled: false, expected: state.context });
    expect((await adapter.filters('microphone'))[0]).toMatchObject({ enabled: false, settings: { db: -9 } });
    await expect(adapter.execute({ kind: 'filter-remove', inputId: 'microphone', filterName: 'Gain', confirmed: false, expected: state.context })).rejects.toMatchObject({ kind: 'validation' });
    await adapter.execute({ kind: 'filter-remove', inputId: 'microphone', filterName: 'Gain', confirmed: true, expected: state.context });
    expect(await adapter.filters('microphone')).toEqual([]);
  });
  it('reads back an allowlisted output preset, preserves unrelated profile settings and requires handler reload', async () => {
    const { server, adapter } = kit();
    let state = await adapter.inspect();
    state = await adapter.execute({ kind: 'output-preset', preset: 'balanced', replayEnabled: true, replaySeconds: 45, expected: state.context });
    expect(state.outputPreset).toMatchObject({ mode: 'Simple', videoBitrate: 4500, recordingFormat: 'mkv', replayEnabled: true, replaySeconds: 45, status: 'saved-reload-required' });
    expect(server.profile.get('Other/Keep')).toBe('unchanged');
    expect(server.requests.filter(row => row.type === 'SetProfileParameter').every(row => ['Output', 'SimpleOutput'].includes(String(row.data?.parameterCategory)))).toBe(true);
    server.ignoreMutation = true;
    await expect(adapter.execute({ kind: 'output-preset', preset: 'quality', replayEnabled: false, replaySeconds: 60, expected: state.context })).rejects.toMatchObject({ kind: 'uncertain' });
  });
  it('receives peak meters without treating them as source configuration and expires stale readings', async () => {
    const { adapter } = kit();
    await adapter.inspect();
    adapter.observe('InputVolumeMeters', { inputs: [{ inputUuid: 'microphone', inputLevelsMul: [[0.25, 0.5, 0.75]] }] });
    const state = await adapter.inspect();
    expect(state.inputs[0]?.audio.peakDb).toBeCloseTo(-6.02, 1);
    adapter.reset();
    expect((await adapter.inspect()).inputs[0]?.audio.peakDb).toBeNull();
  });
  it('bounds meter identities across frames and removes deleted source readings', async () => {
    const { adapter } = kit();
    await adapter.inspect();
    const meter = (inputUuid: string) => ({ inputUuid, inputLevelsMul: [[0.25, 0.5, 0.75]] });
    adapter.observe('InputVolumeMeters', { inputs: [meter('microphone')] });
    for (let index = 0; index < 3; index++) adapter.observe('InputVolumeMeters', { inputs: Array.from({ length: 128 }, (_, offset) => meter('input-' + (index * 128 + offset))) });
    expect((await adapter.inspect()).inputs[0]?.audio.peakDb).toBeNull();
    adapter.observe('InputVolumeMeters', { inputs: [meter('microphone')] });
    adapter.observe('InputRemoved', { inputUuid: 'microphone' });
    expect((await adapter.inspect()).inputs[0]?.audio.peakDb).toBeNull();
  });
  it('bounds the whole inspection when a still-open server stops answering input reads', async () => {
    const server = new ObsProductionServer();
    const request = server.request.bind(server);
    server.request = async (type, data) => type === 'GetInputVolume' ? new Promise(() => {}) : request(type, data);
    const adapter = new ObsProductionAdapter(server, server.snapshot, () => new Set(PRODUCTION_REQUESTS), server.context, server.secrets, 30);
    await expect(adapter.inspect()).rejects.toMatchObject({ kind: 'service' });
    expect(server.requests.filter(row => row.type === 'GetInputList')).toHaveLength(1);
  });
  it('creates and edits current Windows GDI v3 text sources while preserving unrelated properties', async () => {
    const { server, adapter } = kit();
    let state = await adapter.inspect();
    expect(state.inputKinds).toContain('text_gdiplus_v3');
    state = await adapter.execute({ kind: 'input-create', sceneId: 'game', name: 'Current text', inputKind: 'text_gdiplus_v3', settings: { text: 'Public heading', read_from_file: false, color: 16777215 }, enabled: true, expected: state.context });
    const input = state.inputs.find(value => value.name === 'Current text')!;
    await adapter.execute({ kind: 'input-settings', inputId: input.id, settings: { text: 'Updated public heading' }, expected: state.context });
    expect(server.inputSettings.get('Current text')).toMatchObject({ text: 'Updated public heading', color: 16777215, read_from_file: false });
  });
});
