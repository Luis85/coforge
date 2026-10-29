import { IntegrationFailure } from '../../features/coforge/domain/integration-failure';
import type { ObsOutputPreset } from '../../features/coforge/domain/obs-production';
import type { ObsProductionRpc } from './obs-production-rpc';
const parameters = [
  ['Output', 'Mode'], ['SimpleOutput', 'VBitrate'], ['SimpleOutput', 'ABitrate'],
  ['SimpleOutput', 'RecQuality'], ['SimpleOutput', 'RecFormat2'], ['SimpleOutput', 'RecRB'], ['SimpleOutput', 'RecRBTime'],
] as const;
/** The profile allowlist is deliberately closed: no arbitrary config or credential parameter reads. */
export async function readOutputPreset(rpc: ObsProductionRpc): Promise<ObsOutputPreset | undefined> {
  const values: string[] = [];
  for (const [parameterCategory, parameterName] of parameters) {
    const result = await rpc.request('GetProfileParameter', { parameterCategory, parameterName });
    const value = result.parameterValue;
    if (typeof value !== 'string' || value.length > 100) return undefined;
    values.push(value);
  }
  const [mode, bitrate, audio, quality, format, replay, seconds] = values;
  if (!mode || !quality || !format || !Number.isFinite(Number(bitrate)) || !Number.isFinite(Number(audio)) || !Number.isFinite(Number(seconds))) return undefined;
  return { mode, videoBitrate: Number(bitrate), audioBitrate: Number(audio), recordingQuality: quality, recordingFormat: format, replayEnabled: replay === 'true' || replay === '1', replaySeconds: Number(seconds), status: 'observed' };
}
export async function writeOutputPreset(rpc: ObsProductionRpc, preset: 'balanced' | 'quality', replayEnabled: boolean, replaySeconds: number): Promise<void> {
  if (!['balanced', 'quality'].includes(preset) || !Number.isInteger(replaySeconds) || replaySeconds < 5 || replaySeconds > 600)
    throw new IntegrationFailure('validation', 'Choose a supported output preset and a replay length between 5 and 600 seconds.');
  const desired = ['Simple', preset === 'quality' ? '6000' : '4500', preset === 'quality' ? '192' : '160', 'HQ', 'mkv', replayEnabled ? 'true' : 'false', String(replaySeconds)];
  for (const [index, [parameterCategory, parameterName]] of parameters.entries()) {
    const parameterValue = desired[index];
    if (parameterValue === undefined) throw new IntegrationFailure('validation', 'The output preset is incomplete.');
    await rpc.request('SetProfileParameter', { parameterCategory, parameterName, parameterValue });
    const actual = await rpc.request('GetProfileParameter', { parameterCategory, parameterName });
    if (actual.parameterValue !== parameterValue)
      throw new IntegrationFailure('uncertain', 'OBS did not confirm every saved output setting. Inspect the profile before continuing.');
  }
}
