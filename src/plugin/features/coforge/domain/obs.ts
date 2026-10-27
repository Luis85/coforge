export interface ObsSettings {
  endpoint: string;
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
  busy: boolean;
  prepared: boolean;
  onBreak: boolean;
  uncertain: boolean;
  lastError?: string;
}
export type ObsCommandKind = "prepare" | "go-live" | "pause" | "resume" | "stop";
export interface ObsCommand {
  id: string;
  kind: ObsCommandKind;
  at: string;
  status: "pending" | "confirmed" | "failed" | "uncertain" | "reconciled";
}
export interface ObsActions {
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
  "stream-studio-opened",
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
