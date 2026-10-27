import type { ObsPublicState, ObsSettings } from "./obs";
import type { TwitchState } from "./twitch";
import type { IntegrationSettings } from "./types";
import { STREAM_METRIC_SCOPES } from "./stream-metrics";

export interface StreamSetupState {
  dismissed: boolean;
  completedAt?: string;
}
export type SetupStepId = "tools" | "connection" | "scenes" | "twitch" | "review";
export interface SetupStep {
  id: SetupStepId;
  title: string;
  ready: boolean;
  detail: string;
}
export interface StreamSetupInput {
  obs: ObsPublicState;
  settings: ObsSettings;
  twitch: TwitchState;
  integration: IntegrationSettings;
  outputReviewed: boolean;
  now?: number;
}
/** Derive facts on each read. Persisted guide completion never substitutes for current provider state. */
export function streamSetupProgress({
  obs,
  settings,
  twitch,
  integration,
  outputReviewed,
  now = Date.now(),
}: StreamSetupInput) {
  const age = now - Date.parse(obs.snapshot?.observedAt ?? "");
  const connected = obs.connection === "connected" && age >= 0 && age <= 30000 && !obs.uncertain;
  const installation = obs.installation;
  const tools = connected || (installation !== undefined && installation.status !== "missing");
  const scenes =
    connected &&
    Boolean(settings.liveSceneId) &&
    Boolean(obs.snapshot?.scenes.some((scene) => scene.id === settings.liveSceneId)) &&
    (!settings.breakSceneId ||
      (settings.breakSceneId !== settings.liveSceneId &&
        Boolean(obs.snapshot?.scenes.some((scene) => scene.id === settings.breakSceneId))));
  const expectedBot = integration.twitchBotUsesStreamer ? integration.twitchBroadcasterId : integration.twitchBotUserId;
  const analytics = STREAM_METRIC_SCOPES.every((scope) => twitch.streamer?.scopes.includes(scope));
  const channel =
    integration.twitchEnabled &&
    twitch.phase === "connected" &&
    twitch.streamer?.id === integration.twitchBroadcasterId &&
    twitch.channel?.id === integration.twitchBroadcasterId &&
    Boolean(expectedBot) &&
    twitch.bot?.id === expectedBot &&
    twitch.canManage &&
    twitch.canModerate &&
    twitch.canChat &&
    analytics;
  const stable =
    connected && !obs.busy && !obs.snapshot?.active && !obs.snapshot?.transitioning && !obs.snapshot?.reconnecting;
  const steps: SetupStep[] = [
    {
      id: "tools",
      title: "Find OBS",
      ready: tools,
      detail: connected
        ? "OBS verified through WebSocket."
        : installation?.status === "remote"
          ? "Remote OBS: connect to verify the server."
          : installation?.status === "running"
            ? "OBS is already running."
            : installation?.status === "found"
              ? "Installed OBS found."
              : installation?.status === "missing"
                ? "Install OBS Studio or choose its executable."
                : "Check this computer for OBS Studio.",
    },
    {
      id: "connection",
      title: "Connect OBS",
      ready: connected,
      detail: connected
        ? "WebSocket connection verified."
        : obs.lastError || "Enable the WebSocket server and connect securely.",
    },
    {
      id: "scenes",
      title: "Choose scenes",
      ready: scenes,
      detail: scenes ? "Saved scenes are available in OBS." : "Save an available go-live scene and optional BRB scene.",
    },
    {
      id: "twitch",
      title: "Connect Twitch",
      ready: Boolean(channel),
      detail: !integration.twitchClientId
        ? "Add the Client ID of your public Twitch application."
        : !twitch.streamer
          ? "Authorize the streamer account."
          : !twitch.canManage || !twitch.canModerate || !twitch.canChat
            ? "Authorize the required channel, moderation and chatbot permissions."
            : !analytics
              ? "Reconnect the streamer to grant subscriber read permission for stream JSON. Follower totals use existing channel access."
              : !channel
                ? "Enable chat reception and verify the connected channel."
                : "Channel permissions and chatbot connection verified.",
    },
    {
      id: "review",
      title: "Review & prepare",
      ready: outputReviewed && Boolean(stable),
      detail: outputReviewed
        ? "OBS destination, audio and video reviewed by you."
        : "Review the output in OBS; CoForge does not inspect stream keys.",
    },
  ];
  return { steps, ready: steps.every((step) => step.ready), next: steps.find((step) => !step.ready)?.id ?? "review" };
}
