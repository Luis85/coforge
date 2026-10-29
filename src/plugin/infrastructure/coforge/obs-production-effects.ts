import type { ObsProductionAction, ObsProductionSnapshot, ObsInputSettings } from '../../features/coforge/domain/obs-production';
import { IntegrationFailure } from '../../features/coforge/domain/integration-failure';
import { record } from '../../features/coforge/domain/check';
import type { ObsProductionRpc, ObsProductionRequest } from './obs-production-rpc';
import { boundedList, boundedText } from './obs-production-read';
import { checkedProductionSettings, sameSettings } from './obs-production-settings';
import type { TwitchSecrets } from './twitch-auth';
import { writeOutputPreset } from './obs-production-preset';
import { setTimeout as delay } from 'node:timers/promises';
export interface ProductionEffect {
  confirm(after: ObsProductionSnapshot): boolean | Promise<boolean>;
  lastRecording?: string;
  lastReplay?: string;
  destination?: ObsProductionSnapshot['destination'];
}
function validation(message: string): never { throw new IntegrationFailure('validation', message); }
export function productionInput(state: ObsProductionSnapshot, id: string) {
  const input = state.inputs.find(value => value.id === id);
  if (!input) validation('The selected source no longer exists. Refresh OBS sources.');
  return input;
}
export function productionScene(state: ObsProductionSnapshot, id: string) {
  const scene = state.broadcast.scenes.find(value => value.id === id);
  if (!scene) validation('The selected scene no longer exists. Refresh OBS scenes.');
  return scene;
}
function offline(state: ObsProductionSnapshot): void {
  if (state.broadcast.active || state.recording?.active || state.replayBuffer?.active || state.virtualCamera?.active || state.outputActivity)
    validation('Stop the stream, recording, replay buffer and virtual camera before changing production output setup.');
  if ([state.recording, state.replayBuffer, state.virtualCamera].some(value => value === null) && state.outputActivity !== false)
    validation('OBS output activity is unavailable. Refresh and verify all outputs are stopped before changing setup.');
}
async function confirmSettings(rpc: ObsProductionRpc, name: string, settings: ObsInputSettings) {
  const actual = await rpc.request('GetInputSettings', { inputName: name });
  return sameSettings(record(actual.inputSettings), settings);
}
async function selectedTransition(rpc: ObsProductionRpc, name: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 3000;
  do {
    const value = await rpc.request('GetCurrentSceneTransition');
    if (value.transitionName === name) return value;
    await delay(100);
  } while (Date.now() < deadline);
  throw new IntegrationFailure('uncertain', 'OBS did not confirm the selected transition. Refresh before taking it live.');
}
export async function productionEffect(rpc: ObsProductionRpc, state: ObsProductionSnapshot, action: ObsProductionAction, secrets: TwitchSecrets): Promise<ProductionEffect> {
  switch (action.kind) {
    case 'studio-mode':
      await rpc.request('SetStudioModeEnabled', { studioModeEnabled: action.enabled });
      return { confirm: after => after.studioMode === action.enabled };
    case 'preview-scene': {
      if (!state.studioMode) validation('Enable Studio Mode before choosing the preview scene.');
      const scene = productionScene(state, action.sceneId);
      await rpc.request('SetCurrentPreviewScene', { sceneName: scene.name });
      return { confirm: after => after.broadcast.previewSceneId === scene.id };
    }
    case 'transition': {
      if (!state.studioMode || !state.broadcast.previewSceneId) validation('Enable Studio Mode and select a preview scene before transitioning.');
      const transition = state.transitions.find(value => value.name === action.name);
      if (!transition) validation('The selected transition is unavailable. Refresh OBS transitions.');
      if (!Number.isFinite(action.duration) || action.duration < 50 || action.duration > 20000) validation('Transition duration must be between 50 and 20,000 ms.');
      await rpc.request('SetCurrentSceneTransition', { transitionName: transition.name });
      const selected = await selectedTransition(rpc, transition.name);
      if (selected.transitionFixed !== true) await rpc.request('SetCurrentSceneTransitionDuration', { transitionDuration: action.duration });
      await rpc.request('TriggerStudioModeTransition');
      return { confirm: after => after.broadcast.programSceneId === state.broadcast.previewSceneId };
    }
    case 'input-create': {
      const scene = productionScene(state, action.sceneId);
      if (!action.name.trim() || action.name.length > 128 || state.inputs.some(input => input.name === action.name)) validation('Choose a unique source name, up to 128 characters.');
      if (!state.inputKinds.includes(action.inputKind)) validation('This source kind is not available in the connected OBS.');
      const settings = checkedProductionSettings(action.inputKind, action.settings);
      const created = await rpc.request('CreateInput', { sceneName: scene.name, inputName: action.name, inputKind: action.inputKind, inputSettings: settings, sceneItemEnabled: action.enabled });
      return { confirm: async after => {
        const members = boundedList((await rpc.request('GetSceneItemList', { sceneName: scene.name })).sceneItems, 1000);
        return after.inputs.some(input => input.name === action.name && input.kind === action.inputKind)
          && members.some(value => { const item = record(value); return item.sceneItemId === created.sceneItemId && item.sourceName === action.name && item.sceneItemEnabled === action.enabled; })
          && await confirmSettings(rpc, action.name, settings);
      } };
    }
    case 'input-settings': {
      const input = productionInput(state, action.inputId);
      const settings = checkedProductionSettings(input.kind, action.settings);
      await rpc.request('SetInputSettings', { inputName: input.name, inputSettings: settings, overlay: true });
      return { confirm: () => confirmSettings(rpc, input.name, settings) };
    }
    case 'input-mute':
    case 'input-volume':
    case 'input-monitor':
    case 'input-sync':
    case 'input-tracks': {
      const input = productionInput(state, action.inputId);
      let type: ObsProductionRequest;
      let payload: Record<string, unknown>;
      if (action.kind === 'input-mute') { type = 'SetInputMute'; payload = { inputMuted: action.muted }; }
      else if (action.kind === 'input-volume') {
        if (!Number.isFinite(action.volumeDb) || action.volumeDb < -100 || action.volumeDb > 26) validation('Audio volume must be between -100 and 26 dB.');
        type = 'SetInputVolume'; payload = { inputVolumeDb: action.volumeDb };
      } else if (action.kind === 'input-monitor') { type = 'SetInputAudioMonitorType'; payload = { monitorType: action.monitor }; }
      else if (action.kind === 'input-sync') {
        if (!Number.isInteger(action.syncOffset) || Math.abs(action.syncOffset) > 20000) validation('Audio sync must be within 20,000 ms.');
        type = 'SetInputAudioSyncOffset'; payload = { inputAudioSyncOffset: action.syncOffset };
      } else {
        if (!Object.keys(action.tracks).length || Object.entries(action.tracks).some(([key, value]) => !/^[1-6]$/.test(key) || typeof value !== 'boolean')) validation('Choose at least one audio track setting using track numbers 1 through 6.');
        type = 'SetInputAudioTracks'; payload = { inputAudioTracks: action.tracks };
      }
      await rpc.request(type, { inputName: input.name, ...payload });
      return { confirm: after => {
        const audio = after.inputs.find(value => value.id === input.id)?.audio;
        if (!audio) return false;
        if (action.kind === 'input-mute') return audio.muted === action.muted;
        if (action.kind === 'input-volume') return audio.volumeDb !== null && Math.abs(audio.volumeDb - action.volumeDb) < 0.05;
        if (action.kind === 'input-monitor') return audio.monitor === action.monitor;
        if (action.kind === 'input-sync') return audio.syncOffset === action.syncOffset;
        return Object.entries(action.tracks).every(([key, value]) => audio.tracks?.[key] === value);
      } };
    }
    case 'item-transform':
    case 'item-lock': {
      const scene = productionScene(state, action.sceneId);
      const target = { sceneName: scene.name, sceneItemId: action.itemId };
      const list = await rpc.request('GetSceneItemList', { sceneName: scene.name });
      if (!boundedList(list.sceneItems, 1000).some(value => record(value).sceneItemId === action.itemId)) validation('The selected scene item no longer exists.');
      if (action.kind === 'item-lock') {
        await rpc.request('SetSceneItemLocked', { ...target, sceneItemLocked: action.locked });
        return { confirm: async () => boundedList((await rpc.request('GetSceneItemList', { sceneName: scene.name })).sceneItems, 1000).some(value => { const item = record(value); return item.sceneItemId === action.itemId && item.sceneItemLocked === action.locked; }) };
      }
      await rpc.request('SetSceneItemTransform', { ...target, sceneItemTransform: action.transform });
      return { confirm: async () => {
        const actual = record((await rpc.request('GetSceneItemTransform', target)).sceneItemTransform);
        return Object.entries(action.transform).every(([key, value]) => typeof value === 'number' && typeof actual[key] === 'number' ? Math.abs(value - Number(actual[key])) < 0.05 : actual[key] === value);
      } };
    }
    case 'filter-create':
    case 'filter-settings':
    case 'filter-enabled':
    case 'filter-remove': {
      const input = productionInput(state, action.inputId);
      const target = { sourceName: input.name, filterName: action.filterName };
      const list = boundedList((await rpc.request('GetSourceFilterList', { sourceName: input.name })).filters).map(value => record(value));
      const existing = list.find(value => value.filterName === action.filterName);
      let desired: ObsInputSettings | undefined;
      if (action.kind === 'filter-create') {
        if (existing || !action.filterName.trim() || !state.filterKinds.includes(action.filterKind)) validation('Choose an available filter kind and a unique filter name.');
        desired = checkedProductionSettings(action.filterKind, action.settings, true);
        await rpc.request('CreateSourceFilter', { ...target, filterKind: action.filterKind, filterSettings: desired });
      } else {
        if (!existing) validation('The selected filter no longer exists.');
        if (action.kind === 'filter-remove') {
          if (!action.confirmed) validation('Confirm removal of the selected filter.');
          await rpc.request('RemoveSourceFilter', target);
        } else if (action.kind === 'filter-enabled') await rpc.request('SetSourceFilterEnabled', { ...target, filterEnabled: action.enabled });
        else {
          desired = checkedProductionSettings(boundedText(existing.filterKind), action.settings, true);
          await rpc.request('SetSourceFilterSettings', { ...target, filterSettings: desired, overlay: true });
        }
      }
      return { confirm: async () => {
        const actual = boundedList((await rpc.request('GetSourceFilterList', { sourceName: input.name })).filters).map(value => record(value)).find(value => value.filterName === action.filterName);
        if (action.kind === 'filter-remove') return !actual;
        if (!actual) return false;
        if (action.kind === 'filter-enabled') return actual.filterEnabled === action.enabled;
        return desired !== undefined && sameSettings(record(actual.filterSettings), desired);
      } };
    }
    case 'record-start': case 'record-stop': case 'record-pause': case 'record-resume':
    case 'replay-start': case 'replay-stop': case 'replay-save':
    case 'virtual-camera-start': case 'virtual-camera-stop': {
      const requests: Record<typeof action.kind, ObsProductionRequest> = { 'record-start': 'StartRecord', 'record-stop': 'StopRecord', 'record-pause': 'PauseRecord', 'record-resume': 'ResumeRecord', 'replay-start': 'StartReplayBuffer', 'replay-stop': 'StopReplayBuffer', 'replay-save': 'SaveReplayBuffer', 'virtual-camera-start': 'StartVirtualCam', 'virtual-camera-stop': 'StopVirtualCam' };
      const status = action.kind.startsWith('record-') ? state.recording : action.kind.startsWith('replay-') ? state.replayBuffer : state.virtualCamera;
      if (!status) validation('OBS did not provide the selected output status. Refresh before changing it.');
      const starts = action.kind.endsWith('-start');
      if (starts === status.active && !['record-pause', 'record-resume', 'replay-save'].includes(action.kind)) validation(starts ? 'This output is already active.' : 'This output is already stopped.');
      if (['record-pause', 'record-resume', 'replay-save'].includes(action.kind) && !status.active) validation('Start the selected output before this action.');
      if (action.kind === 'record-pause' && status.paused || action.kind === 'record-resume' && !status.paused) validation('The recording is already in the requested pause state.');
      const priorReplay = action.kind === 'replay-save' ? boundedText((await rpc.request('GetLastReplayBufferReplay')).savedReplayPath, 4096) : null;
      const response = await rpc.request(requests[action.kind]);
      if (action.kind === 'replay-save') {
        const effect: ProductionEffect = { confirm: async () => {
          const replay = await rpc.request('GetLastReplayBufferReplay');
          const path = boundedText(replay.savedReplayPath, 4096);
          if (!path || path === priorReplay) return false;
          effect.lastReplay = path;
          return true;
        } };
        return effect;
      }
      const path = action.kind === 'record-stop' ? boundedText(response.outputPath, 4096) : undefined;
      return { ...(path ? { lastRecording: path } : {}), confirm: after => {
        const actual = action.kind.startsWith('record-') ? after.recording : action.kind.startsWith('replay-') ? after.replayBuffer : after.virtualCamera;
        if (action.kind === 'record-pause') return actual?.active === true && actual.paused;
        if (action.kind === 'record-resume') return actual?.active === true && !actual.paused;
        return actual?.active === starts;
      } };
    }
    case 'media-action': {
      const input = productionInput(state, action.inputId);
      await rpc.request('TriggerMediaInputAction', { inputName: input.name, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_' + action.action.toUpperCase() });
      return { confirm: async () => {
        const actual = await rpc.request('GetMediaInputStatus', { inputName: input.name });
        const expected = action.action === 'pause' ? 'OBS_MEDIA_STATE_PAUSED' : action.action === 'stop' ? 'OBS_MEDIA_STATE_STOPPED' : 'OBS_MEDIA_STATE_PLAYING';
        return actual.mediaState === expected;
      } };
    }
    case 'video-settings': {
      offline(state);
      if (Object.values(action.video).some(value => !Number.isInteger(value) || value < 1 || value > 4096)) validation('Video settings must be positive integers within the supported OBS range.');
      await rpc.request('SetVideoSettings', { ...action.video });
      return { confirm: after => after.video !== null && Object.entries(action.video).every(([key, value]) => Reflect.get(after.video!, key) === value) };
    }
    case 'output-preset':
      offline(state);
      await writeOutputPreset(rpc, action.preset, action.replayEnabled, action.replaySeconds);
      return { confirm: after => after.outputPreset?.mode === 'Simple' && after.outputPreset.replayEnabled === action.replayEnabled && after.outputPreset.replaySeconds === action.replaySeconds && after.outputPreset.videoBitrate === (action.preset === 'quality' ? 6000 : 4500) };
    case 'record-directory':
      offline(state);
      if (!action.directory || action.directory.length > 4096 || action.directory.includes('\0')) validation('Enter a recording directory, up to 4,096 characters.');
      await rpc.request('SetRecordDirectory', { recordDirectory: action.directory });
      return { confirm: after => after.recordDirectory === action.directory };
    case 'stream-service': {
      offline(state);
      if (!/^coforge-obs-output-[a-zA-Z0-9_-]{1,80}$/.test(action.keySecret)) validation('Choose a dedicated CoForge OBS output secret.');
      const key = secrets.getSecret(action.keySecret);
      if (!key) validation('Save a stream key in Obsidian secret storage before configuring the destination.');
      if (!action.server || action.server.length > 2048) validation('Enter a supported destination server.');
      if (action.service !== 'Twitch' || action.server !== 'auto') {
        let server: URL;
        try { server = new URL(action.server); } catch { validation('Enter an RTMP or RTMPS destination URL.'); }
        const hasCredentials = Boolean(server.username || server.password);
        if (!['rtmp:', 'rtmps:'].includes(server.protocol) || !server.hostname || hasCredentials || server.search || server.hash)
          validation('Use an RTMP or RTMPS server URL without embedded credentials, query parameters or fragments.');
      }
      await rpc.request('SetStreamServiceSettings', { streamServiceType: action.service === 'Twitch' ? 'rtmp_common' : 'rtmp_custom', streamServiceSettings: { ...(action.service === 'Twitch' ? { service: 'Twitch' } : {}), server: action.server, key } });
      return { destination: { service: action.service, server: action.server, status: 'accepted-unverified' }, confirm: () => true };
    }
  }
}
