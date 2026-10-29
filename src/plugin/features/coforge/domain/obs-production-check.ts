import { boolean, number, oneOf, optional, record, shape, text, type Check } from './check';
import type { ObsInputSettings, ObsProductionAction, ObsSceneTransform } from './obs-production';

const id = text({ min: 1, max: 300 });
const name = text({ trim: true, min: 1, max: 128 });
const context = shape({ epoch: number({ integer: true, min: 0 }), collection: number({ integer: true, min: 0 }), revision: number({ integer: true, min: 0 }) }, { strict: true });
export const obsInputSettingsCheck: Check<ObsInputSettings> = value => {
  const entries = Object.entries(record(value));
  if (entries.length > 64) throw new Error('Source settings allow at most 64 fields.');
  return Object.fromEntries(entries.map(([key, item]) => {
    text({ min: 1, max: 100, pattern: /^[a-zA-Z0-9_-]+$/ })(key);
    if (typeof item === 'string') return [key, text({ max: 4000 })(item)];
    if (typeof item === 'number') return [key, number()(item)];
    if (typeof item === 'boolean') return [key, item];
    throw new Error('Source settings must be text, numbers or booleans.');
  }));
};
const tracks: Check<Record<string, boolean>> = value => {
  const entries = Object.entries(record(value));
  if (entries.length > 6 || entries.some(([key]) => !/^[1-6]$/.test(key))) throw new Error('Choose audio tracks 1 through 6.');
  return Object.fromEntries(entries.map(([key, item]) => [key, boolean(item)]));
};
const transform: Check<Partial<ObsSceneTransform>> = shape({
  positionX: optional(number({ min: -32768, max: 32768 })), positionY: optional(number({ min: -32768, max: 32768 })),
  scaleX: optional(number({ min: -100, max: 100 })), scaleY: optional(number({ min: -100, max: 100 })), rotation: optional(number({ min: -3600, max: 3600 })),
  cropLeft: optional(number({ integer: true, min: 0, max: 32768 })), cropRight: optional(number({ integer: true, min: 0, max: 32768 })),
  cropTop: optional(number({ integer: true, min: 0, max: 32768 })), cropBottom: optional(number({ integer: true, min: 0, max: 32768 })),
  boundsType: optional(oneOf(['OBS_BOUNDS_NONE', 'OBS_BOUNDS_STRETCH', 'OBS_BOUNDS_SCALE_INNER', 'OBS_BOUNDS_SCALE_OUTER', 'OBS_BOUNDS_SCALE_TO_WIDTH', 'OBS_BOUNDS_SCALE_TO_HEIGHT', 'OBS_BOUNDS_MAX_ONLY'])),
  boundsWidth: optional(number({ min: 0, max: 32768 })), boundsHeight: optional(number({ min: 0, max: 32768 })), alignment: optional(number({ integer: true, min: 0, max: 15 })),
}, { strict: true });
export const obsVideoSettingsCheck = shape({ baseWidth: number({ integer: true, min: 1, max: 4096 }), baseHeight: number({ integer: true, min: 1, max: 4096 }),
  outputWidth: number({ integer: true, min: 1, max: 4096 }), outputHeight: number({ integer: true, min: 1, max: 4096 }), fpsNumerator: number({ integer: true, min: 1, max: 240 }), fpsDenominator: number({ integer: true, min: 1, max: 1001 }) }, { strict: true });
export const obsProductionActionCheck: Check<ObsProductionAction> = value => {
  const kind = record(value).kind;
  const common = { expected: context };
  const options = { strict: true };
  switch (kind) {
    case 'studio-mode': return shape({ ...common, kind: oneOf(['studio-mode']), enabled: boolean }, options)(value);
    case 'preview-scene': return shape({ ...common, kind: oneOf(['preview-scene']), sceneId: id }, options)(value);
    case 'transition': return shape({ ...common, kind: oneOf(['transition']), name, duration: number({ integer: true, min: 50, max: 20000 }) }, options)(value);
    case 'input-create': return shape({ ...common, kind: oneOf(['input-create']), sceneId: id, name, inputKind: id, settings: obsInputSettingsCheck, enabled: boolean }, options)(value);
    case 'input-settings': return shape({ ...common, kind: oneOf(['input-settings']), inputId: id, settings: obsInputSettingsCheck }, options)(value);
    case 'input-mute': return shape({ ...common, kind: oneOf(['input-mute']), inputId: id, muted: boolean }, options)(value);
    case 'input-volume': return shape({ ...common, kind: oneOf(['input-volume']), inputId: id, volumeDb: number({ min: -100, max: 26 }) }, options)(value);
    case 'input-monitor': return shape({ ...common, kind: oneOf(['input-monitor']), inputId: id, monitor: oneOf(['OBS_MONITORING_TYPE_NONE', 'OBS_MONITORING_TYPE_MONITOR_ONLY', 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT']) }, options)(value);
    case 'input-sync': return shape({ ...common, kind: oneOf(['input-sync']), inputId: id, syncOffset: number({ integer: true, min: -20000, max: 20000 }) }, options)(value);
    case 'input-tracks': return shape({ ...common, kind: oneOf(['input-tracks']), inputId: id, tracks }, options)(value);
    case 'item-transform': return shape({ ...common, kind: oneOf(['item-transform']), sceneId: id, itemId: number({ integer: true, min: 0 }), transform }, options)(value);
    case 'item-lock': return shape({ ...common, kind: oneOf(['item-lock']), sceneId: id, itemId: number({ integer: true, min: 0 }), locked: boolean }, options)(value);
    case 'filter-create': return shape({ ...common, kind: oneOf(['filter-create']), inputId: id, filterName: name, filterKind: id, settings: obsInputSettingsCheck }, options)(value);
    case 'filter-settings': return shape({ ...common, kind: oneOf(['filter-settings']), inputId: id, filterName: name, settings: obsInputSettingsCheck }, options)(value);
    case 'filter-enabled': return shape({ ...common, kind: oneOf(['filter-enabled']), inputId: id, filterName: name, enabled: boolean }, options)(value);
    case 'filter-remove': return shape({ ...common, kind: oneOf(['filter-remove']), inputId: id, filterName: name, confirmed: boolean }, options)(value);
    case 'record-start': case 'record-stop': case 'record-pause': case 'record-resume': case 'replay-start': case 'replay-stop': case 'replay-save': case 'virtual-camera-start': case 'virtual-camera-stop':
      return shape({ ...common, kind: oneOf([kind]) }, options)(value);
    case 'media-action': return shape({ ...common, kind: oneOf(['media-action']), inputId: id, action: oneOf(['play', 'pause', 'stop', 'restart', 'next', 'previous']) }, options)(value);
    case 'video-settings': return shape({ ...common, kind: oneOf(['video-settings']), video: obsVideoSettingsCheck }, options)(value);
    case 'output-preset': return shape({ ...common, kind: oneOf(['output-preset']), preset: oneOf(['balanced', 'quality']), replayEnabled: boolean, replaySeconds: number({ integer: true, min: 5, max: 300 }) }, options)(value);
    case 'record-directory': return shape({ ...common, kind: oneOf(['record-directory']), directory: text({ trim: true, min: 1, max: 1000 }) }, options)(value);
    case 'stream-service': return shape({ ...common, kind: oneOf(['stream-service']), service: oneOf(['Twitch', 'Custom']), server: text({ min: 1, max: 1000 }), keySecret: text({ pattern: /^coforge-obs-output-[a-zA-Z0-9_-]{1,80}$/ }) }, options)(value);
    default: throw new Error('Choose a supported OBS production action.');
  }
};
