import type { StreamHistory, StreamSample } from '../../../features/coforge/domain/stream-metrics';
export function recordedStatistics(id: string, startedAt: string, channelId = '123'): StreamHistory {
  const samples: StreamSample[] = [0, 1, 2].map(minute => ({
    channelId, at: new Date(Date.parse(startedAt) + minute * 60000).toISOString(), minute, gapSeconds: 0,
    twitch: { state: 'live', streamId: id, startedAt, viewers: minute * 10, followers: 100 + minute, subscribers: 4, subscriptionPoints: 4, channel: null, unavailable: [] },
    obs: { state: 'live', startedAt, scene: 'Synthetic gameplay', health: { bitrateKbps: 6000, stats_cpuUsage: 15 } },
    coforge: { counters: {}, streamCounters: { 'twitch-message-observed': minute * 5 }, intervalCounters: { 'twitch-message-observed': 5 }, registeredPlayers: 2, blockedPlayers: 0, coins: 10, xp: 20, reputation: 30, chatPresenceSeconds: 120, requestsByStatus: {}, requestsByProject: {}, botRepliesByStatus: {} },
  }));
  return { schemaVersion: 1, id, channelId, startedAt, twitchStreamId: id, obsStartedAt: startedAt, endedAt: new Date(Date.parse(startedAt) + 180000).toISOString(), endReason: 'offline', baselineCounters: {}, samples };
}
