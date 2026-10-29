import { record } from '../../features/coforge/domain/check';
import { IntegrationFailure } from '../../features/coforge/domain/integration-failure';
import type { ObsInputSettings, ObsSettingValue } from '../../features/coforge/domain/obs-production';

const inputFields: Record<string, readonly string[]> = {
  browser_source: ['url', 'width', 'height', 'is_local_file', 'local_file', 'reroute_audio', 'restart_when_active', 'shutdown', 'css'],
  image_source: ['file', 'unload'],
  ffmpeg_source: ['local_file', 'is_local_file', 'looping', 'close_when_inactive', 'restart_on_activate', 'buffering_mb'],
  text_gdiplus_v2: ['text', 'color', 'opacity', 'read_from_file', 'file'],
  text_gdiplus_v3: ['text', 'color', 'opacity', 'read_from_file', 'file'],
  text_ft2_source_v2: ['text', 'color1', 'color2', 'from_file', 'text_file'],
  wasapi_input_capture: ['device_id', 'use_device_timing'],
  wasapi_output_capture: ['device_id', 'use_device_timing'],
  wasapi_process_output_capture: ['window', 'priority', 'exclude_process_tree'],
  dshow_input: ['video_device_id', 'res_type', 'resolution', 'frame_interval', 'video_format', 'audio_device_id', 'use_custom_audio_device', 'active'],
  window_capture: ['window', 'priority', 'method', 'cursor', 'capture_cursor', 'client_area'],
  game_capture: ['capture_mode', 'window', 'priority', 'capture_cursor', 'allow_transparency', 'hook_rate', 'anti_cheat_hook', 'force_scaling', 'scale_res'],
  monitor_capture: ['monitor_id', 'monitor', 'capture_cursor', 'method', 'compatibility'],
  color_source_v3: ['color', 'width', 'height'],
  pulse_input_capture: ['device_id'], pulse_output_capture: ['device_id'],
  v4l2_input: ['device_id', 'input', 'pixelformat', 'resolution', 'framerate', 'color_range', 'buffering'],
  av_capture_input: ['device', 'device_name', 'use_preset', 'preset', 'resolution', 'frame_rate'],
  coreaudio_input_capture: ['device_id'], coreaudio_output_capture: ['device_id'],
  screen_capture: ['display', 'show_cursor', 'show_empty_names', 'application', 'window', 'type'],
};
const filterFields: Record<string, readonly string[]> = {
  gain_filter: ['db'], compressor_filter: ['ratio', 'threshold', 'attack_time', 'release_time', 'output_gain', 'sidechain_source'],
  limiter_filter: ['threshold', 'release_time'], expander_filter: ['ratio', 'threshold', 'attack_time', 'release_time', 'output_gain', 'detector', 'presets'],
  noise_gate_filter: ['open_threshold', 'close_threshold', 'attack_time', 'hold_time', 'release_time'],
  noise_suppress_filter: ['suppress_level'], noise_suppress_filter_v2: ['method', 'suppress_level'],
  color_filter_v2: ['gamma', 'contrast', 'brightness', 'saturation', 'hue_shift', 'opacity', 'color_multiply', 'color_add'],
  crop_filter: ['left', 'top', 'right', 'bottom', 'cx', 'cy', 'relative'],
  chroma_key_filter_v2: ['key_color_type', 'key_color', 'similarity', 'smoothness', 'spill', 'opacity', 'contrast', 'brightness', 'gamma'],
  sharpness_filter: ['sharpness'],
};
export const supportedInputKind = (kind: string) => Object.hasOwn(inputFields, kind);
export const supportedFilterKind = (kind: string) => Object.hasOwn(filterFields, kind);
function fields(kind: string, filter: boolean): readonly string[] {
  const table = filter ? filterFields : inputFields;
  const values = Object.hasOwn(table, kind) ? table[kind] : undefined;
  if (!values) throw new IntegrationFailure('validation', 'This source or filter needs a supported editor. Use OBS for its vendor-specific configuration.');
  return values;
}
function scalar(value: unknown): value is ObsSettingValue {
  return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 16384 && !value.includes('\0'));
}
export function checkedProductionSettings(kind: string, value: unknown, filter = false): ObsInputSettings {
  const allowed = fields(kind, filter);
  const input = record(value);
  const entries = Object.entries(input);
  if (entries.length > 32 || entries.some(([key, item]) => !allowed.includes(key) || !scalar(item)))
    throw new IntegrationFailure('validation', 'The source settings include an unsupported or oversized property.');
  const result: ObsInputSettings = {};
  for (const [key, item] of entries) if (scalar(item)) result[key] = item;
  if (typeof result.url === 'string') {
    if (/\[redacted\]|%5Bredacted%5D/i.test(result.url))
      throw new IntegrationFailure('validation', 'Enter a complete replacement URL. A hidden credential placeholder cannot be saved to OBS.');
    let url: URL;
    try { url = new URL(result.url); } catch { throw new IntegrationFailure('validation', 'Enter a valid HTTP or HTTPS browser source URL.'); }
    const hasCredentials = Boolean(url.username || url.password);
    if (!['http:', 'https:'].includes(url.protocol) || hasCredentials)
      throw new IntegrationFailure('validation', 'Browser sources support HTTP or HTTPS URLs without embedded credentials.');
  }
  return result;
}
/** Only explicitly supported settings reach private UI; secret-looking URL components are redacted. */
export function projectedProductionSettings(kind: string, value: unknown, filter = false): ObsInputSettings {
  const table = filter ? filterFields : inputFields;
  const allowed = Object.hasOwn(table, kind) ? table[kind] ?? [] : [];
  const result: ObsInputSettings = {};
  const input = record(value);
  for (const key of allowed) {
    const item = input[key];
    if (!scalar(item)) continue;
    if (key === 'url' && typeof item === 'string') {
      try {
        const url = new URL(item);
        const removed = Boolean(url.username || url.password || url.hash);
        url.username = ''; url.password = '';
        for (const name of url.searchParams.keys())
          if (/token|secret|auth|key|pass|signature|credential/i.test(name)) url.searchParams.set(name, '[redacted]');
        url.hash = '';
        if (removed) url.searchParams.set('_coforge_redacted', '[redacted]');
        result[key] = url.toString();
      } catch { result[key] = ''; }
    } else result[key] = item;
  }
  return result;
}
export function sameSettings(actual: Record<string, unknown>, desired: ObsInputSettings): boolean {
  return Object.entries(desired).every(([key, value]) => actual[key] === value);
}
