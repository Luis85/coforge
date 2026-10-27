import type { StreamHistory, StreamSample } from "../../src/plugin/features/coforge/domain/stream-metrics";
/** Explicit browser-only example dataset. Never loaded or persisted by the production plugin. */
export function previewStreamStatistics(): StreamHistory[] {
  return [0, 1, 2, 3].map((day) => {
    const start = Date.parse(`2026-10-${27 - day}T18:00:00Z`);
    const length = 60 - day * 7;
    const samples: StreamSample[] = [];
    let chatTotal = 0;
    let requestTotal = 0;
    let voteTotal = 0;
    let bugTotal = 0;
    for (let minute = 0; minute < length; minute++) {
      if (minute === 18 || minute === 19) continue;
      const viewers =
        minute === 33 ? null : Math.max(0, Math.round(28 + minute / 2 + 10 * Math.sin(minute / 6) - day * 4));
      const messages = Math.max(0, Math.round(8 + 5 * Math.sin(minute / 4) + day));
      chatTotal += messages;
      const requests = minute % 11 === 0 ? 1 : 0;
      const votes = minute % 4;
      const bugs = minute % 17 === 0 ? 1 : 0;
      requestTotal += requests;
      voteTotal += votes;
      bugTotal += bugs;
      samples.push({
        channelId: "sample-channel",
        at: new Date(start + minute * 60000).toISOString(),
        minute,
        gapSeconds: minute === 20 ? 120 : 0,
        twitch: {
          state: "live",
          streamId: `sample-${day}`,
          startedAt: new Date(start).toISOString(),
          viewers,
          channel: {
            id: "sample-channel",
            login: "example",
            name: "Example channel",
            title: "Example game-development stream",
            categoryId: "sample",
            categoryName: "Development",
          },
          followers: 200 + Math.floor(minute / 10) + day * 3,
          subscribers: 12 + Math.floor(minute / 25),
          subscriptionPoints: 20,
          unavailable: minute === 33 ? ["stream"] : [],
        },
        obs: {
          state: "live",
          startedAt: new Date(start).toISOString(),
          scene: "Example gameplay",
          health: {
            bitrateKbps: 6000 + Math.round(300 * Math.sin(minute)),
            outputDroppedFramePercent: 0.12 + day / 10,
            stats_activeFps: 60,
            stats_cpuUsage: 18 + 4 * Math.cos(minute / 4),
            stats_memoryUsage: 1200 + minute,
            outputCongestion: 0.02,
          },
        },
        coforge: {
          counters: {},
          streamCounters: {
            "twitch-message-observed": chatTotal,
            "request-created": requestTotal,
            "vote-counted": voteTotal,
            "bug-created": bugTotal,
          },
          intervalCounters: {
            "twitch-message-observed": messages,
            "request-created": requests,
            "vote-counted": votes,
            "bug-created": bugs,
          },
          registeredPlayers: 24 + minute,
          blockedPlayers: 0,
          coins: minute * 24,
          xp: minute * 24,
          reputation: minute * 10,
          chatPresenceSeconds: minute * 60 * 24,
          requestsByStatus: {},
          requestsByProject: {},
          botRepliesByStatus: {},
        },
      });
    }
    return {
      schemaVersion: 1,
      id: `example-stream-${day}`,
      channelId: "sample-channel",
      startedAt: new Date(start).toISOString(),
      twitchStreamId: `sample-${day}`,
      obsStartedAt: new Date(start).toISOString(),
      endedAt: new Date(start + length * 60000).toISOString(),
      endReason: "offline",
      baselineCounters: {},
      samples,
    };
  });
}
