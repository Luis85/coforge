import type { ObsSnapshot } from '../../../features/coforge/domain/obs';
import { record } from '../../../features/coforge/domain/check';
/** Stateful protocol fixture: effects and readback can diverge to exercise uncertain outcomes. */
export class ObsProductionServer {
  requests: Array<{ type: string; data?: Record<string, unknown> }> = [];
  revision = 1;
  epoch = 1;
  collection = 1;
  active = false;
  muted = false;
  volumeDb = -6;
  audioMonitor = 'OBS_MONITORING_TYPE_NONE';
  syncOffset = 0;
  audioTracks: Record<string, boolean> = { '1': true, '2': false };
  transitionName = 'Fade';
  studioMode = false;
  program = 'game';
  preview = 'game';
  recording = false;
  paused = false;
  replay = false;
  camera = false;
  lastReplay = '';
  ignoreMutation = false;
  frame = 'data:image/png;base64,aGVsbG8=';
  destination?: Record<string, unknown>;
  inputs = [{ inputUuid: 'microphone', inputName: 'Microphone', inputKind: 'wasapi_input_capture' }];
  scenes = [{ id: 'game', name: 'Game' }, { id: 'break', name: 'BRB' }];
  inputSettings = new Map<string, Record<string, unknown>>([['Microphone', { device_id: 'default', password: 'private-stream-key' }]]);
  profile = new Map<string, string>([['Output/Mode', 'Simple'], ['SimpleOutput/VBitrate', '6000'], ['SimpleOutput/ABitrate', '160'], ['SimpleOutput/RecQuality', 'Stream'], ['SimpleOutput/RecFormat2', 'mkv'], ['SimpleOutput/RecRB', 'false'], ['SimpleOutput/RecRBTime', '20'], ['Other/Keep', 'unchanged']]);
  itemTransform: Record<string, unknown> = { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0, boundsType: 'OBS_BOUNDS_NONE', boundsWidth: 0, boundsHeight: 0, alignment: 5 };
  itemLocked = false;
  filters: Array<Record<string, unknown>> = [];
  private secretValues = new Map<string, string>();
  secrets = { getSecret: (name: string) => this.secretValues.get(name) ?? null, setSecret: (name: string, value: string) => { this.secretValues.set(name, value); } };
  context = () => ({ epoch: this.epoch, collection: this.collection, revision: this.revision });
  snapshot = async (): Promise<ObsSnapshot> => ({
    ...this.context(), sceneVersion: this.revision, sceneCollectionVersion: this.collection,
    scenes: this.scenes, programSceneId: this.program,
    previewSceneId: this.preview, active: this.active, reconnecting: false, transitioning: false,
    timecode: '00:00:00.000', observedAt: new Date().toISOString(),
  });
  async request(type: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.requests.push({ type, data });
    if (!type.startsWith('Get') && this.ignoreMutation) return {};
    switch (type) {
      case 'GetInputList': return { inputs: this.inputs };
      case 'GetInputKindList': return { inputKinds: ['wasapi_input_capture', 'browser_source', 'image_source', 'color_source_v3', 'window_capture', 'game_capture', 'dshow_input', 'text_gdiplus_v3'] };
      case 'GetSourceFilterKindList': return { sourceFilterKinds: ['gain_filter', 'compressor_filter'] };
      case 'GetInputSettings': return { inputSettings: this.inputSettings.get(String(data?.inputName)) ?? {} };
      case 'SetInputSettings': this.inputSettings.set(String(data?.inputName), { ...this.inputSettings.get(String(data?.inputName)), ...record(data?.inputSettings) }); return {};
      case 'CreateInput': {
        const name = String(data?.inputName);
        const id = 'input-' + this.inputs.length;
        this.inputs.push({ inputUuid: id, inputName: name, inputKind: String(data?.inputKind) });
        this.inputSettings.set(name, record(data?.inputSettings ?? {}));
        return { inputUuid: id, sceneItemId: this.inputs.length };
      }
      case 'GetInputPropertiesListPropertyItems': return { propertyItems: [{ itemName: 'Default device', itemValue: 'default', itemEnabled: true }] };
      case 'GetSceneItemList': return { sceneItems: this.inputs.map((input, index) => ({ sceneItemId: index + 1, sourceName: input.inputName, sceneItemLocked: this.itemLocked, sceneItemEnabled: true })) };
      case 'GetOutputList': return { outputs: [{ outputActive: this.active }, { outputActive: this.recording }, { outputActive: this.replay }, { outputActive: this.camera }] };
      case 'GetSceneItemTransform': return { sceneItemTransform: this.itemTransform };
      case 'SetSceneItemTransform': this.itemTransform = { ...this.itemTransform, ...record(data?.sceneItemTransform) }; return {};
      case 'SetSceneItemLocked': this.itemLocked = data?.sceneItemLocked === true; return {};
      case 'GetSourceFilterList': return { filters: this.filters };
      case 'CreateSourceFilter': this.filters.push({ filterName: data?.filterName, filterKind: data?.filterKind, filterSettings: data?.filterSettings, filterIndex: this.filters.length, filterEnabled: true }); return {};
      case 'SetSourceFilterSettings': { const filter = this.filters.find(value => value.filterName === data?.filterName); if (filter) filter.filterSettings = data?.filterSettings; return {}; }
      case 'SetSourceFilterEnabled': { const filter = this.filters.find(value => value.filterName === data?.filterName); if (filter) filter.filterEnabled = data?.filterEnabled; return {}; }
      case 'RemoveSourceFilter': this.filters = this.filters.filter(value => value.filterName !== data?.filterName); return {};
      case 'GetProfileParameter': return { parameterValue: this.profile.get(String(data?.parameterCategory) + '/' + String(data?.parameterName)) ?? null, defaultParameterValue: null };
      case 'SetProfileParameter': this.profile.set(String(data?.parameterCategory) + '/' + String(data?.parameterName), String(data?.parameterValue)); return {};
      case 'GetInputMute': return { inputMuted: this.muted };
      case 'SetInputMute': this.muted = data?.inputMuted === true; return {};
      case 'GetInputVolume': return { inputVolumeDb: this.volumeDb };
      case 'SetInputVolume': this.volumeDb = Number(data?.inputVolumeDb); return {};
      case 'GetInputAudioMonitorType': return { monitorType: this.audioMonitor };
      case 'SetInputAudioMonitorType': this.audioMonitor = String(data?.monitorType); return {};
      case 'GetInputAudioSyncOffset': return { inputAudioSyncOffset: this.syncOffset };
      case 'SetInputAudioSyncOffset': this.syncOffset = Number(data?.inputAudioSyncOffset); return {};
      case 'GetInputAudioTracks': return { inputAudioTracks: this.audioTracks };
      case 'SetInputAudioTracks': this.audioTracks = Object.fromEntries(Object.entries(record(data?.inputAudioTracks)).map(([key, value]) => [key, value === true])); return {};
      case 'GetStudioModeEnabled': return { studioModeEnabled: this.studioMode };
      case 'SetStudioModeEnabled': this.studioMode = data?.studioModeEnabled === true; return {};
      case 'SetCurrentPreviewScene': this.preview = data?.sceneName === 'BRB' ? 'break' : 'game'; return {};
      case 'GetSceneTransitionList': return { transitions: [{ transitionName: 'Fade', transitionKind: 'fade_transition' }, { transitionName: 'Cut', transitionKind: 'cut_transition' }] };
      case 'GetCurrentSceneTransition': return { transitionName: this.transitionName, transitionKind: this.transitionName === 'Cut' ? 'cut_transition' : 'fade_transition', transitionFixed: this.transitionName === 'Cut', transitionDuration: 300 };
      case 'SetCurrentSceneTransition': this.transitionName = String(data?.transitionName); return {};
      case 'TriggerStudioModeTransition': this.program = this.preview; return {};
      case 'GetRecordStatus': return { outputActive: this.recording, outputPaused: this.paused, outputTimecode: '00:00:00.000' };
      case 'StartRecord': this.recording = true; return {};
      case 'StopRecord': this.recording = false; return { outputPath: 'C:/Recordings/test.mkv' };
      case 'PauseRecord': this.paused = true; return {};
      case 'ResumeRecord': this.paused = false; return {};
      case 'GetReplayBufferStatus': return { outputActive: this.replay };
      case 'StartReplayBuffer': this.replay = true; return {};
      case 'StopReplayBuffer': this.replay = false; return {};
      case 'SaveReplayBuffer': this.lastReplay = 'C:/Recordings/replay.mkv'; return {};
      case 'GetLastReplayBufferReplay': return { savedReplayPath: this.lastReplay };
      case 'GetVirtualCamStatus': return { outputActive: this.camera };
      case 'StartVirtualCam': this.camera = true; return {};
      case 'StopVirtualCam': this.camera = false; return {};
      case 'GetVideoSettings': return { baseWidth: 1920, baseHeight: 1080, outputWidth: 1920, outputHeight: 1080, fpsNumerator: 30, fpsDenominator: 1 };
      case 'GetRecordDirectory': return { recordDirectory: 'C:/Recordings' };
      case 'SetStreamServiceSettings': this.destination = data; return {};
      case 'GetSourceScreenshot': return { imageData: this.frame };
      default: return {};
    }
  }
}
