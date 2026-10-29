import type { ObsSnapshot } from './obs';
import type { ObsSceneContext } from './obs-scenes';

export type ObsSettingValue = string | number | boolean;
export type ObsInputSettings = Record<string, ObsSettingValue>;
export const OBS_TEXT_INPUT_KINDS = ['text_gdiplus_v2', 'text_gdiplus_v3', 'text_ft2_source_v2'] as const;
export const obsTextInputKind = (kind: string): boolean => OBS_TEXT_INPUT_KINDS.some(value => value === kind);
export const obsTextFileFlag = (kind: string): 'read_from_file' | 'from_file' | null =>
  obsTextInputKind(kind) ? kind === 'text_ft2_source_v2' ? 'from_file' : 'read_from_file' : null;
export type ObsAudioMonitor = 'OBS_MONITORING_TYPE_NONE' | 'OBS_MONITORING_TYPE_MONITOR_ONLY' | 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT';
export interface ObsAudioInput {
  muted: boolean | null;
  volumeDb: number | null;
  monitor: ObsAudioMonitor | null;
  syncOffset: number | null;
  tracks: Record<string, boolean> | null;
  peakDb: number | null;
  meterObservedAt: string | null;
}
export interface ObsProductionInput {
  id: string;
  name: string;
  kind: string;
  settings: ObsInputSettings;
  audio: ObsAudioInput;
}
export interface ObsOutputStatus { active: boolean; paused: boolean; timecode: string }
export interface ObsVideoSettings { baseWidth: number; baseHeight: number; outputWidth: number; outputHeight: number; fpsNumerator: number; fpsDenominator: number }
export interface ObsTransition { name: string; kind: string; fixed: boolean; duration: number | null }
export interface ObsOutputPreset { mode: string; videoBitrate: number; audioBitrate: number; recordingQuality: string; recordingFormat: string; replayEnabled: boolean; replaySeconds: number; status: 'observed' | 'saved-reload-required' }
export interface ObsProductionSnapshot {
  context: ObsSceneContext;
  broadcast: ObsSnapshot;
  observedAt: string;
  available: ObsProductionKind[];
  inputKinds: string[];
  filterKinds: string[];
  inputs: ObsProductionInput[];
  studioMode: boolean | null;
  transitions: ObsTransition[];
  transition: ObsTransition | null;
  recording: ObsOutputStatus | null;
  replayBuffer: ObsOutputStatus | null;
  virtualCamera: ObsOutputStatus | null;
  video: ObsVideoSettings | null;
  recordDirectory: string | null;
  lastRecording: string | null;
  lastReplay: string | null;
  destination?: { service: 'Twitch' | 'Custom'; server: string; status: 'accepted-unverified' };
  outputPreset?: ObsOutputPreset;
  outputActivity?: boolean | null;
}
export interface ObsProductionFrame { sceneId: string; dataUrl: string; observedAt: string; kind: 'screenshot' }
export interface ObsPropertyOption { label: string; value: string | number; enabled: boolean }
export interface ObsSceneTransform {
  positionX: number; positionY: number; scaleX: number; scaleY: number; rotation: number;
  cropLeft: number; cropRight: number; cropTop: number; cropBottom: number;
  boundsType: string; boundsWidth: number; boundsHeight: number; alignment: number;
}
export interface ObsSourceFilter { name: string; kind: string; enabled: boolean; index: number; settings: ObsInputSettings }
export const OBS_PRODUCTION_KINDS = [
  'studio-mode', 'preview-scene', 'transition', 'input-create', 'input-settings',
  'input-mute', 'input-volume', 'input-monitor', 'input-sync', 'input-tracks',
  'item-transform', 'item-lock', 'filter-create', 'filter-settings', 'filter-enabled', 'filter-remove',
  'record-start', 'record-stop', 'record-pause', 'record-resume', 'replay-start', 'replay-stop', 'replay-save',
  'virtual-camera-start', 'virtual-camera-stop', 'media-action', 'video-settings', 'record-directory', 'stream-service', 'output-preset',
] as const;
export type ObsProductionKind = typeof OBS_PRODUCTION_KINDS[number];
type Input = { inputId: string };
type Filter = Input & { filterName: string };
export type ObsProductionAction = { expected: ObsSceneContext } & (
  | { kind: 'studio-mode'; enabled: boolean }
  | { kind: 'preview-scene'; sceneId: string }
  | { kind: 'transition'; name: string; duration: number }
  | { kind: 'input-create'; sceneId: string; name: string; inputKind: string; settings: ObsInputSettings; enabled: boolean }
  | (Input & { kind: 'input-settings'; settings: ObsInputSettings })
  | (Input & { kind: 'input-mute'; muted: boolean })
  | (Input & { kind: 'input-volume'; volumeDb: number })
  | (Input & { kind: 'input-monitor'; monitor: ObsAudioMonitor })
  | (Input & { kind: 'input-sync'; syncOffset: number })
  | (Input & { kind: 'input-tracks'; tracks: Record<string, boolean> })
  | { kind: 'item-transform'; sceneId: string; itemId: number; transform: Partial<ObsSceneTransform> }
  | { kind: 'item-lock'; sceneId: string; itemId: number; locked: boolean }
  | (Filter & { kind: 'filter-create'; filterKind: string; settings: ObsInputSettings })
  | (Filter & { kind: 'filter-settings'; settings: ObsInputSettings })
  | (Filter & { kind: 'filter-enabled'; enabled: boolean })
  | (Filter & { kind: 'filter-remove'; confirmed: boolean })
  | { kind: 'record-start' | 'record-stop' | 'record-pause' | 'record-resume' | 'replay-start' | 'replay-stop' | 'replay-save' | 'virtual-camera-start' | 'virtual-camera-stop' }
  | (Input & { kind: 'media-action'; action: 'play' | 'pause' | 'stop' | 'restart' | 'next' | 'previous' })
  | { kind: 'video-settings'; video: ObsVideoSettings }
  | { kind: 'record-directory'; directory: string }
  | { kind: 'stream-service'; service: 'Twitch' | 'Custom'; server: string; keySecret: string }
  | { kind: 'output-preset'; preset: 'balanced' | 'quality'; replayEnabled: boolean; replaySeconds: number }
);
