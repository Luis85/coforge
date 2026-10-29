import type { ObsInputSettings, ObsVideoSettings } from './obs-production';
import type { ObsSceneContext } from './obs-scenes';

export const OBS_SETUP_ROLES = ['starting', 'development', 'council', 'playtest', 'brb', 'ending'] as const;
export type ObsSetupRole = typeof OBS_SETUP_ROLES[number];
export const OBS_SETUP_NAMES: Record<ObsSetupRole, string> = { starting: 'Starting soon', development: 'Development', council: 'Council', playtest: 'Playtest', brb: 'BRB', ending: 'Ending' };
export interface ObsSetupSource { name: string; inputKind: string; settings: ObsInputSettings; roles: ObsSetupRole[]; enabled: boolean }
export interface ObsSetupInput {
  prefix: string; video?: ObsVideoSettings; recordDirectory?: string; sources: ObsSetupSource[];
  outputPreset?: { preset: 'balanced' | 'quality'; replayEnabled: boolean; replaySeconds: number };
  service?: { service: 'Twitch' | 'Custom'; server: string; keySecret: string };
}
export interface ObsSetupScene { role: ObsSetupRole; name: string; existingId?: string }
export interface ObsSetupPreview { id: string; context: ObsSceneContext; input: ObsSetupInput; scenes: ObsSetupScene[]; steps: string[]; sourceReuse?: Record<string, string> }
export interface ObsSetupState {
  id: string; startedAt: string; status: 'running' | 'confirmed' | 'failed' | 'uncertain' | 'acknowledged';
  completed: string[]; pendingStep?: string; total: number; scenes: Record<string, string>; lastError?: string;
}
export interface ObsSetupResult { state: ObsSetupState; liveSceneId: string; breakSceneId: string }
