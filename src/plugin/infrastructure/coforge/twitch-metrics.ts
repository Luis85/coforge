import type { TwitchApi } from "./twitch-api";
import type { TwitchMetrics } from "../../features/coforge/domain/stream-metrics";

/** Retains aggregate totals only; subscriber/follower identities and raw provider errors are discarded. */
export async function readTwitchMetrics(
  api: Pick<TwitchApi, "metricStream" | "channel" | "followerTotal" | "subscriptionTotals">,
): Promise<TwitchMetrics> {
  const [stream, channel, followers, subscriptions] = await Promise.allSettled([
    api.metricStream(),
    api.channel(),
    api.followerTotal(),
    api.subscriptionTotals(),
  ]);
  const live = stream.status === "fulfilled" ? stream.value : null;
  return {
    state: stream.status === "rejected" ? "unavailable" : live ? "live" : "offline",
    streamId: live?.id ?? null,
    startedAt: live?.startedAt ?? null,
    viewers: live?.viewers ?? null,
    channel: channel.status === "fulfilled" ? channel.value : null,
    followers: followers.status === "fulfilled" ? followers.value : null,
    subscribers: subscriptions.status === "fulfilled" ? subscriptions.value.total : null,
    subscriptionPoints: subscriptions.status === "fulfilled" ? subscriptions.value.points : null,
    unavailable: [
      stream.status === "rejected" ? "stream" : "",
      channel.status === "rejected" ? "channel" : "",
      followers.status === "rejected" ? "followers" : "",
      subscriptions.status === "rejected" ? "subscriptions" : "",
    ].filter(Boolean),
  };
}
export const unavailableTwitchMetrics = (): TwitchMetrics => ({
  state: "unavailable",
  streamId: null,
  startedAt: null,
  viewers: null,
  channel: null,
  followers: null,
  subscribers: null,
  subscriptionPoints: null,
  unavailable: ["stream", "channel", "followers", "subscriptions"],
});
