import { record } from '../../features/coforge/domain/check';
import { IntegrationFailure } from '../../features/coforge/domain/integration-failure';
import type { ObsAudioInput, ObsAudioMonitor, ObsOutputStatus, ObsProductionInput, ObsProductionSnapshot, ObsTransition, ObsVideoSettings } from '../../features/coforge/domain/obs-production';
import type { ObsSnapshot } from '../../features/coforge/domain/obs';
import { projectedProductionSettings, supportedFilterKind, supportedInputKind } from './obs-production-settings';
import { productionCapabilities, type ObsProductionRequest, type ObsProductionRpc } from './obs-production-rpc';
import { sceneContext } from '../../features/coforge/domain/obs-scenes';
import { readOutputPreset } from './obs-production-preset';

export function boundedText(value: unknown, max = 300): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\0'))
    throw new IntegrationFailure('service', 'OBS returned invalid or oversized production data.');
  return value;
}
export function boundedList(value: unknown, max = 128): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new IntegrationFailure('service', 'OBS returned an incomplete or oversized production list.');
  return value;
}
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const flag = (value: unknown): boolean | null => typeof value === 'boolean' ? value : null;
export function audioMonitor(value: unknown): ObsAudioMonitor | null {
  return value === 'OBS_MONITORING_TYPE_NONE' || value === 'OBS_MONITORING_TYPE_MONITOR_ONLY' || value === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT' ? value : null;
}
export function audioTracks(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = record(value);
  const result: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(input)) {
    if (!/^[1-6]$/.test(key) || typeof item !== 'boolean') return null;
    result[key] = item;
  }
  return result;
}
export function outputStatus(value: Record<string, unknown> | null): ObsOutputStatus | null {
  if (!value || typeof value.outputActive !== 'boolean') return null;
  return { active: value.outputActive, paused: value.outputPaused === true, timecode: typeof value.outputTimecode === 'string' ? value.outputTimecode.slice(0, 40) : '' };
}
export function videoSettings(value: Record<string, unknown> | null): ObsVideoSettings | null {
  if (!value) return null;
  const { baseWidth, baseHeight, outputWidth, outputHeight, fpsNumerator, fpsDenominator } = value;
  if ([baseWidth, baseHeight, outputWidth, outputHeight, fpsNumerator, fpsDenominator].some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return null;
  if (typeof baseWidth !== 'number' || typeof baseHeight !== 'number' || typeof outputWidth !== 'number' || typeof outputHeight !== 'number' || typeof fpsNumerator !== 'number' || typeof fpsDenominator !== 'number') return null;
  return { baseWidth, baseHeight, outputWidth, outputHeight, fpsNumerator, fpsDenominator };
}
export function transition(value: Record<string, unknown> | null): ObsTransition | null {
  if (!value || typeof value.transitionName !== 'string') return null;
  return { name: boundedText(value.transitionName), kind: typeof value.transitionKind === 'string' ? boundedText(value.transitionKind) : '', fixed: value.transitionFixed === true, duration: finite(value.transitionDuration) };
}
export async function optionalProductionRead(rpc: ObsProductionRpc, available: ReadonlySet<string>, type: ObsProductionRequest, data?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!available.has(type)) return null;
  try { return await rpc.request(type, data); } catch { return null; }
}
export async function readProductionInput(rpc: ObsProductionRpc, available: ReadonlySet<string>, value: unknown, meter?: { peakDb: number; observedAt: string }): Promise<ObsProductionInput> {
  const input = record(value);
  const name = boundedText(input.inputName);
  const id = typeof input.inputUuid === 'string' && input.inputUuid ? boundedText(input.inputUuid) : name;
  const kind = boundedText(input.inputKind);
  const target = { inputName: name };
  const read = (type: ObsProductionRequest) => optionalProductionRead(rpc, available, type, target);
  const [settings, mute, volume, monitor, sync, tracks] = await Promise.all([
    read('GetInputSettings'), read('GetInputMute'), read('GetInputVolume'), read('GetInputAudioMonitorType'), read('GetInputAudioSyncOffset'), read('GetInputAudioTracks'),
  ]);
  const audio: ObsAudioInput = {
    muted: flag(mute?.inputMuted), volumeDb: finite(volume?.inputVolumeDb), monitor: audioMonitor(monitor?.monitorType),
    syncOffset: finite(sync?.inputAudioSyncOffset), tracks: audioTracks(tracks?.inputAudioTracks),
    peakDb: meter?.peakDb ?? null, meterObservedAt: meter?.observedAt ?? null,
  };
  return { id, name, kind, settings: projectedProductionSettings(kind, settings?.inputSettings ?? {}), audio };
}
export async function readProduction(rpc: ObsProductionRpc, available: ReadonlySet<string>, broadcast: ObsSnapshot, meters: ReadonlyMap<string, { peakDb: number; observedAt: string }>): Promise<ObsProductionSnapshot> {
  const read = (type: ObsProductionRequest) => optionalProductionRead(rpc, available, type);
  const [list, kinds, filters, studio, transitions, currentTransition, recording, replay, camera, video, directory] = await Promise.all([
    read('GetInputList'), read('GetInputKindList'), read('GetSourceFilterKindList'), read('GetStudioModeEnabled'),
    read('GetSceneTransitionList'), read('GetCurrentSceneTransition'), read('GetRecordStatus'), read('GetReplayBufferStatus'),
    read('GetVirtualCamStatus'), read('GetVideoSettings'), read('GetRecordDirectory'),
  ]);
  const inputs: ObsProductionInput[] = [];
  if (available.has('GetInputList') && !list)
    throw new IntegrationFailure('service', 'OBS source inventory is unavailable. Refresh before changing production controls.');
  for (const value of boundedList(list?.inputs ?? [])) {
    const raw = record(value);
    inputs.push(await readProductionInput(rpc, available, raw, meters.get(String(raw.inputUuid ?? raw.inputName))));
  }
  if (new Set(inputs.map(input => input.id)).size !== inputs.length)
    throw new IntegrationFailure('service', 'OBS returned duplicate production input identities.');
  const outputPreset = available.has('GetProfileParameter') ? await readOutputPreset(rpc).catch(() => undefined) : undefined;
  const outputs = await read('GetOutputList');
  const outputActivity = Array.isArray(outputs?.outputs) && outputs.outputs.length <= 128 && outputs.outputs.every(value => value && typeof value === 'object' && typeof Reflect.get(value, 'outputActive') === 'boolean')
    ? outputs.outputs.some(value => Reflect.get(value, 'outputActive') === true) : null;
  return {
    context: sceneContext(broadcast), broadcast, observedAt: new Date().toISOString(), available: productionCapabilities(available), inputs,
    inputKinds: boundedList(kinds?.inputKinds ?? [], 256).map(value => boundedText(value)).filter(supportedInputKind),
    filterKinds: boundedList(filters?.sourceFilterKinds ?? [], 256).map(value => boundedText(value)).filter(supportedFilterKind),
    studioMode: flag(studio?.studioModeEnabled), transition: transition(currentTransition),
    transitions: boundedList(transitions?.transitions ?? []).map(value => transition(record(value))).filter((value): value is ObsTransition => value !== null),
    recording: outputStatus(recording), replayBuffer: outputStatus(replay), virtualCamera: outputStatus(camera),
    video: videoSettings(video), recordDirectory: typeof directory?.recordDirectory === 'string' ? boundedText(directory.recordDirectory, 4096) : null,
    lastRecording: null, lastReplay: null,
    ...(outputPreset ? { outputPreset } : {}),
    outputActivity,
  };
}
