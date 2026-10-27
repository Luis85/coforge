export interface ObsSettings {
  endpoint: string;
  executable: string;
  passwordSecret: string;
  autoConnect: boolean;
  liveSceneId: string;
  breakSceneId: string;
}
export interface ObsScene {
  id: string;
  name: string;
}
export interface ObsSnapshot {
  sceneVersion?: number;
  sceneCollectionVersion?: number;
  previewSceneId?: string | null;
  health?: Record<string, number | null>;
  epoch: number;
  revision: number;
  scenes: ObsScene[];
  programSceneId: string | null;
  active: boolean;
  reconnecting: boolean;
  transitioning: boolean;
  timecode: string;
  observedAt: string;
}
export type ObsConnection = "disconnected" | "connecting" | "authenticating" | "connected" | "reconnecting" | "error";
export interface ObsObservation {
  connection: ObsConnection;
  snapshot?: ObsSnapshot;
  error?: string;
}
export interface ObsPublicState extends ObsObservation {
  installation?: ObsInstallation;
  busy: boolean;
  prepared: boolean;
  onBreak: boolean;
  uncertain: boolean;
  lastError?: string;
}
export type ObsCommandKind = "prepare" | "go-live" | "pause" | "resume" | "stop";
export interface ObsCommand {
  id: string;
  kind: ObsCommandKind | import('./obs-scenes').ObsSceneKind;
  at: string;
  status: "pending" | "confirmed" | "failed" | "uncertain" | "reconciled";
}
export interface ObsActions {
  detect(): Promise<void>;
  open(): Promise<void>;
  configure(input: unknown): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  refresh(): Promise<void>;
  prepare(): Promise<void>;
  goLive(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setPassword(value: string): Promise<void>;
}
export const defaultObsSettings = (): ObsSettings => ({
  endpoint: "ws://127.0.0.1:4455/",
  executable: "",
  passwordSecret: "coforge-obs-password",
  autoConnect: false,
  liveSceneId: "",
  breakSceneId: "",
});
export const emptyObsState = (): ObsPublicState => ({
  connection: "disconnected",
  busy: false,
  prepared: false,
  onBreak: false,
  uncertain: false,
});
export const OBS_OPERATION_CODES = [
  'obs-scene-action-requested', 'obs-scene-action-confirmed', 'obs-scene-action-failed', 'obs-scene-action-uncertain',
  "obs-detection-requested",
  "obs-detected",
  "stream-studio-opened",
  "obs-open-requested",
  "obs-opened",
  "obs-open-failed",
  "obs-settings-save-requested",
  "obs-settings-saved",
  "obs-password-save-requested",
  "obs-password-saved",
  "obs-connect-requested",
  "obs-connected",
  "obs-connection-changed",
  "obs-disconnect-requested",
  "obs-disconnected",
  "obs-refresh-requested",
  "obs-refreshed",
  "obs-scene-changed",
  "obs-stream-state-changed",
  "stream-prepare-requested",
  "stream-prepared",
  "stream-go-live-requested",
  "stream-started",
  "stream-pause-requested",
  "stream-paused",
  "stream-resume-requested",
  "stream-resumed",
  "stream-stop-requested",
  "stream-stopped",
  "stream-control-rejected",
  "stream-control-failed",
  "stream-control-uncertain",
] as const;

export interface ObsInstallation {
  status: 'found' | 'running' | 'missing' | 'remote';
  running: boolean;
  executable?: string;
  passwordSaved: boolean;
}
