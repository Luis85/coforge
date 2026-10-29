import { describe, expect, it } from 'vitest';
import type { StreamHistory } from '../../../features/coforge/domain/stream-metrics';
import { emptyTwitchOperations, type TwitchOperationsSnapshot } from '../../../features/coforge/domain/twitch-operations';
import { twitchStreamReport } from '../../../features/coforge/domain/twitch-stream-report';

describe('Private Twitch stream review', () => {
  it('counts only this channel and stream interval even when individual events have no stream ID', () => {
    const history: StreamHistory = { schemaVersion: 1, id: 'twitch-123-session', channelId: '123', startedAt: '2026-10-29T10:00:00Z', endedAt: '2026-10-29T12:00:00Z', twitchStreamId: 'session', obsStartedAt: null, endReason: 'offline', baselineCounters: {}, samples: [] };
    const snapshot: TwitchOperationsSnapshot = { ...emptyTwitchOperations(), resources: {}, capabilities: [], activities: [
      { id: 'inside', channelId: '123', type: 'channel.follow', at: '2026-10-29T11:00:00Z', summary: 'Observed follow' },
      { id: 'earlier', channelId: '123', type: 'channel.follow', at: '2026-10-29T09:59:59Z', summary: 'Earlier' },
      { id: 'later', channelId: '123', type: 'channel.follow', at: '2026-10-29T12:00:01Z', summary: 'Later' },
      { id: 'other', channelId: '456', type: 'channel.follow', at: '2026-10-29T11:00:00Z', summary: 'Another channel' },
    ], gaps: [{ channelId: '123', startedAt: '2026-10-29T11:30:00Z', endedAt: '2026-10-29T11:35:00Z', reason: 'Disconnected' }] };
    const report = twitchStreamReport(history, snapshot);
    expect(report).toContain('channel.follow: 1');
    expect(report).toContain('Collection gaps overlapping this stream: 1');
    expect(report).toContain('Recorded audience samples: 0');
    expect(report).not.toContain('Earlier'); expect(report).not.toContain('Another channel');
    expect(report).toContain('not verified video watch time');
  });
});
