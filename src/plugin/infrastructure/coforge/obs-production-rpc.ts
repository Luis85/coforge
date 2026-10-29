import type { ObsProductionKind } from '../../features/coforge/domain/obs-production';
export const PRODUCTION_REQUESTS = [
  'GetInputList', 'GetInputKindList', 'GetInputSettings', 'GetInputMute', 'SetInputMute',
  'GetInputVolume', 'SetInputVolume', 'GetInputAudioMonitorType', 'SetInputAudioMonitorType',
  'GetInputAudioSyncOffset', 'SetInputAudioSyncOffset', 'GetInputAudioTracks', 'SetInputAudioTracks',
  'GetStudioModeEnabled', 'SetStudioModeEnabled', 'SetCurrentPreviewScene', 'GetSceneTransitionList',
  'GetCurrentSceneTransition', 'SetCurrentSceneTransition', 'SetCurrentSceneTransitionDuration',
  'TriggerStudioModeTransition', 'GetRecordStatus', 'StartRecord', 'StopRecord', 'PauseRecord', 'ResumeRecord',
  'GetReplayBufferStatus', 'StartReplayBuffer', 'StopReplayBuffer', 'SaveReplayBuffer', 'GetLastReplayBufferReplay',
  'GetVirtualCamStatus', 'StartVirtualCam', 'StopVirtualCam', 'GetVideoSettings', 'SetVideoSettings',
  'GetRecordDirectory', 'SetRecordDirectory', 'SetStreamServiceSettings', 'GetSourceScreenshot',
  'GetInputPropertiesListPropertyItems', 'CreateInput', 'SetInputSettings', 'GetSceneItemTransform',
  'SetSceneItemTransform', 'SetSceneItemLocked', 'GetSceneItemList', 'GetSourceFilterKindList', 'GetSourceFilterList',
  'CreateSourceFilter', 'SetSourceFilterSettings', 'SetSourceFilterEnabled', 'RemoveSourceFilter',
  'TriggerMediaInputAction', 'GetMediaInputStatus', 'GetProfileParameter', 'SetProfileParameter', 'GetOutputList',
] as const;
export type ObsProductionRequest = typeof PRODUCTION_REQUESTS[number];
export interface ObsProductionRpc {
  request(type: ObsProductionRequest, data?: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>>;
}
const needs: Record<ObsProductionKind, ObsProductionRequest[]> = {
  'studio-mode': ['GetStudioModeEnabled', 'SetStudioModeEnabled'],
  'preview-scene': ['SetCurrentPreviewScene', 'GetStudioModeEnabled'],
  transition: ['GetSceneTransitionList', 'GetCurrentSceneTransition', 'SetCurrentSceneTransition', 'SetCurrentSceneTransitionDuration', 'TriggerStudioModeTransition'],
  'input-create': ['GetInputList', 'CreateInput', 'GetInputSettings', 'GetSceneItemList'],
  'input-settings': ['GetInputSettings', 'SetInputSettings'],
  'input-mute': ['GetInputMute', 'SetInputMute'],
  'input-volume': ['GetInputVolume', 'SetInputVolume'],
  'input-monitor': ['GetInputAudioMonitorType', 'SetInputAudioMonitorType'],
  'input-sync': ['GetInputAudioSyncOffset', 'SetInputAudioSyncOffset'],
  'input-tracks': ['GetInputAudioTracks', 'SetInputAudioTracks'],
  'item-transform': ['GetSceneItemTransform', 'SetSceneItemTransform'],
  'item-lock': ['SetSceneItemLocked', 'GetSceneItemList'],
  'filter-create': ['GetSourceFilterList', 'CreateSourceFilter'],
  'filter-settings': ['GetSourceFilterList', 'SetSourceFilterSettings'],
  'filter-enabled': ['GetSourceFilterList', 'SetSourceFilterEnabled'],
  'filter-remove': ['GetSourceFilterList', 'RemoveSourceFilter'],
  'record-start': ['GetRecordStatus', 'StartRecord'],
  'record-stop': ['GetRecordStatus', 'StopRecord'],
  'record-pause': ['GetRecordStatus', 'PauseRecord'],
  'record-resume': ['GetRecordStatus', 'ResumeRecord'],
  'replay-start': ['GetReplayBufferStatus', 'StartReplayBuffer'],
  'replay-stop': ['GetReplayBufferStatus', 'StopReplayBuffer'],
  'replay-save': ['GetReplayBufferStatus', 'SaveReplayBuffer', 'GetLastReplayBufferReplay'],
  'virtual-camera-start': ['GetVirtualCamStatus', 'StartVirtualCam'],
  'virtual-camera-stop': ['GetVirtualCamStatus', 'StopVirtualCam'],
  'media-action': ['GetMediaInputStatus', 'TriggerMediaInputAction'],
  'video-settings': ['GetVideoSettings', 'SetVideoSettings'],
  'record-directory': ['GetRecordDirectory', 'SetRecordDirectory'],
  'stream-service': ['SetStreamServiceSettings'],
  'output-preset': ['GetProfileParameter', 'SetProfileParameter'],
};
export function productionCapabilities(available: ReadonlySet<string>): ObsProductionKind[] {
  return Object.entries(needs).filter(([, requests]) => requests.every(request => available.has(request)))
    .map(([kind]) => kind).filter((kind): kind is ObsProductionKind => kind in needs);
}
