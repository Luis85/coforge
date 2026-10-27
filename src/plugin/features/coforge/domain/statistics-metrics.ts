import type { StreamSample } from "./stream-metrics";
export type StatisticsGroup = "Audience & growth" | "Community activity" | "OBS health";
const valid = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const interval = (key: string) => (sample: StreamSample) => valid(sample.coforge.intervalCounters[key] ?? 0);
const health = (key: string) => (sample: StreamSample) =>
  sample.obs.state === "live" ? valid(sample.obs.health[key]) : null;
function metric<T extends string>(
  id: T,
  label: string,
  unit: string,
  group: StatisticsGroup,
  read: (sample: StreamSample) => number | null,
  decimals = 0,
  growth = false,
  includeFinal = true,
) {
  return { id, label, unit, group, read, decimals, growth, includeFinal };
}
export const STATISTICS_METRICS = [
  metric(
    "viewers",
    "Concurrent viewers",
    "viewers",
    "Audience & growth",
    (sample) => (sample.twitch.state === "live" ? valid(sample.twitch.viewers) : null),
    0,
    false,
    false,
  ),
  metric("followers", "Followers · total", "followers", "Audience & growth", (sample) =>
    valid(sample.twitch.followers),
  ),
  metric(
    "follower-change",
    "Observed follower change",
    "followers",
    "Audience & growth",
    (sample) => valid(sample.twitch.followers),
    0,
    true,
  ),
  metric("subscribers", "Subscribers · total", "subscribers", "Audience & growth", (sample) =>
    valid(sample.twitch.subscribers),
  ),
  metric(
    "subscriber-change",
    "Observed subscriber change",
    "subscribers",
    "Audience & growth",
    (sample) => valid(sample.twitch.subscribers),
    0,
    true,
  ),
  metric("subscription-points", "Subscriber points", "points", "Audience & growth", (sample) =>
    valid(sample.twitch.subscriptionPoints),
  ),
  metric(
    "chat",
    "Observed Twitch messages / interval",
    "messages",
    "Community activity",
    interval("twitch-message-observed"),
  ),
  metric(
    "commands",
    "Observed Twitch commands / interval",
    "commands",
    "Community activity",
    interval("twitch-command-observed"),
  ),
  metric("requests", "Feature requests / interval", "requests", "Community activity", interval("request-created")),
  metric("bugs", "Bug reports / interval", "bugs", "Community activity", interval("bug-created")),
  metric("votes", "Votes / interval", "votes", "Community activity", interval("vote-counted")),
  metric(
    "registrations",
    "New registrations / interval",
    "registrations",
    "Community activity",
    interval("registered"),
  ),
  metric(
    "moderation",
    "Confirmed moderation / interval",
    "actions",
    "Community activity",
    interval("moderation-confirmed"),
  ),
  metric("players", "Registered players · total", "players", "Community activity", (sample) =>
    valid(sample.coforge.registeredPlayers),
  ),
  metric("coins", "Community currency balance · total", "currency units", "Community activity", (sample) =>
    valid(sample.coforge.coins),
  ),
  metric("xp", "Community XP · total", "XP", "Community activity", (sample) => valid(sample.coforge.xp)),
  metric("reputation", "Community reputation · total", "reputation", "Community activity", (sample) =>
    valid(sample.coforge.reputation),
  ),
  metric("bitrate", "Output bitrate", "kbps", "OBS health", health("bitrateKbps"), 1, false, false),
  metric("dropped", "Dropped output frames", "%", "OBS health", health("outputDroppedFramePercent"), 2, false, false),
  metric("fps", "Active FPS", "FPS", "OBS health", health("stats_activeFps"), 1, false, false),
  metric("cpu", "OBS CPU usage", "%", "OBS health", health("stats_cpuUsage"), 1, false, false),
  metric("memory", "OBS memory usage", "MB", "OBS health", health("stats_memoryUsage"), 1, false, false),
  metric("congestion", "Output congestion", "ratio (0–1)", "OBS health", health("outputCongestion"), 2, false, false),
  metric("blocked-players", "Blocked players · total", "players", "Community activity", (sample) =>
    valid(sample.coforge.blockedPlayers),
  ),
  metric(
    "presence",
    "Tracked chat-presence time · total",
    "minutes",
    "Community activity",
    (sample) => valid(sample.coforge.chatPresenceSeconds / 60),
    1,
  ),
  metric("bot-pending", "Reply queue · pending", "replies", "Community activity", (sample) =>
    valid(sample.coforge.botRepliesByStatus.pending ?? 0),
  ),
  metric("bot-failed", "Reply queue · failed", "replies", "Community activity", (sample) =>
    valid(sample.coforge.botRepliesByStatus.failed ?? 0),
  ),
  metric("bot-uncertain", "Reply queue · unconfirmed", "replies", "Community activity", (sample) =>
    valid(sample.coforge.botRepliesByStatus.uncertain ?? 0),
  ),
  metric(
    "render-time",
    "Mean frame render time",
    "ms",
    "OBS health",
    health("stats_averageFrameRenderTime"),
    2,
    false,
    false,
  ),
  metric("disk", "Available OBS disk space", "MB", "OBS health", health("stats_availableDiskSpace"), 0, false, false),
  metric(
    "skipped-frames",
    "Skipped output frames · cumulative",
    "frames",
    "OBS health",
    health("outputSkippedFrames"),
    0,
    false,
    false,
  ),
  metric(
    "render-skipped",
    "Skipped render frames · cumulative",
    "frames",
    "OBS health",
    health("stats_renderSkippedFrames"),
    0,
    false,
    false,
  ),
] as const;
export type StatisticsMetricId = (typeof STATISTICS_METRICS)[number]["id"];
export type StatisticsMetric = (typeof STATISTICS_METRICS)[number];
export const statisticsMetric = (id: StatisticsMetricId) => STATISTICS_METRICS.find((metric) => metric.id === id)!;
