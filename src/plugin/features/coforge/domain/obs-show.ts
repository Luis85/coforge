
import { OBS_OVERLAY_OPERATION_CODES } from './obs-overlay';
import type { OperationCode } from './population';
/** Production definitions are private, explicit actions. No step starts a broadcast or implicitly publishes note content. */
export type ObsShowStep =
  | { kind: 'scene'; sceneId: string }
  | { kind: 'mute'; inputId: string; muted: boolean }
  | { kind: 'volume'; inputId: string; volumeDb: number }
  | { kind: 'record'; action: 'start' | 'stop' | 'pause' | 'resume' }
  | { kind: 'replay-save' }
  | { kind: 'media'; inputId: string; action: 'play' | 'pause' | 'stop' | 'restart' | 'next' | 'previous' }
  | { kind: 'source-visible'; sceneId: string; itemId: number; enabled: boolean }
  | { kind: 'transition'; sceneId: string; name: string; duration: number }
  | { kind: 'overlay'; overlayId: string }
  | { kind: 'marker'; label: string };
export interface ObsShowSegment { id: string; name: string; note: string; durationSeconds: number; steps: ObsShowStep[] }
export const OBS_SHOW_EVENTS = [
  'stream-started', 'stream-paused', 'stream-resumed', 'stream-stopped', 'request-created', 'job-completed', 'workflow-run-finished',
] as const satisfies readonly OperationCode[];
/** Read compatibility for existing plans and trigger history; these events no longer execute. */
export const LEGACY_MUSIC_EVENTS = ['music-playback-started', 'music-playback-paused', 'music-playback-stopped', 'music-track-ended'] as const;
export interface ObsShowBinding { id: string; event: typeof OBS_SHOW_EVENTS[number] | typeof LEGACY_MUSIC_EVENTS[number]; cueId: string; enabled: boolean }
export interface ObsShowPlan { id: string; name: string; segments: ObsShowSegment[]; bindings: ObsShowBinding[] }
export type ObsShowOutcome = 'pending' | 'confirmed' | 'failed' | 'uncertain' | 'skipped';
export interface ObsShowRunStep { action: ObsShowStep; status: ObsShowOutcome }
export interface ObsShowRun {
  id: string; planId: string; cueId: string; name: string; durationSeconds: number; startedAt: string; finishedAt?: string;
  status: 'running' | 'confirmed' | 'failed' | 'uncertain' | 'acknowledged';
  steps: ObsShowRunStep[]; error?: string; eventSequence?: number;
}
export interface ObsShowMarker { id: string; label: string; at: string; runId?: string }
export interface ObsOutputFile { id: string; at: string; kind: 'recording' | 'replay'; path: string; sceneId?: string; obsEpoch: number; timecode: string; broadcastActive: boolean }
export interface ObsShowState {
  plans: ObsShowPlan[]; history: ObsShowRun[]; run?: ObsShowRun; automationEnabled: boolean;
  lastEventSequence: number; markers: ObsShowMarker[];
  outputFiles?: ObsOutputFile[];
  outputRestartRequired?: boolean;
  overlays?: import('./obs-overlay').ObsOverlayDefinition[];
  lastTrigger?: { event: typeof OBS_SHOW_EVENTS[number] | typeof LEGACY_MUSIC_EVENTS[number]; sequence: number; reason: 'paused' | 'offline' | 'busy' | 'no-binding' | 'partial' | 'completed' | 'failed' };
}
export const emptyObsShow = (): ObsShowState => ({ plans: [], history: [], automationEnabled: false, lastEventSequence: 0, markers: [] });
export const OBS_SHOW_OPERATION_CODES = [
  'obs-production-requested', 'obs-production-confirmed', 'obs-production-failed', 'obs-production-uncertain',
  'obs-output-secret-saved', 'obs-show-plan-saved', 'obs-show-plan-deleted', 'obs-show-cue-requested',
  'obs-output-restart-reviewed',
  ...OBS_OVERLAY_OPERATION_CODES,
  'obs-show-step-confirmed', 'obs-show-cue-confirmed', 'obs-show-cue-failed', 'obs-show-cue-uncertain',
  'obs-show-recovered', 'obs-show-automation-changed', 'obs-show-event-skipped', 'obs-show-marker-added',
  'obs-setup-requested', 'obs-setup-confirmed', 'obs-setup-failed',
] as const;
