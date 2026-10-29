import { summarizeStream, type StreamHistory } from './stream-metrics';
import type { TwitchOperationsSnapshot } from './twitch-operations';

/** Bound private review to observed channel/time evidence; missing stream IDs are not invented. */
export function twitchStreamReport(history: StreamHistory, snapshot: TwitchOperationsSnapshot): string {
  const start = Date.parse(history.startedAt);
  const end = history.endedAt ? Date.parse(history.endedAt) : Date.now();
  const within = (at: string) => Date.parse(at) >= start && Date.parse(at) <= end;
  const activities = snapshot.activities.filter(item => item.channelId === history.channelId && within(item.at)
    && (!item.streamId || !history.twitchStreamId || item.streamId === history.twitchStreamId));
  const counts = new Map<string, number>();
  for (const item of activities) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  const gaps = snapshot.gaps.filter(item => item.channelId === history.channelId
    && Date.parse(item.startedAt) <= end && (!item.endedAt || Date.parse(item.endedAt) >= start));
  const intents = snapshot.intents.filter(item => item.channelId === history.channelId && within(item.createdAt));
  const summary = summarizeStream(history);
  const available = (value: number | null) => value === null ? 'Unavailable' : String(value);
  return ['# Private stream review', '', `Channel: ${history.channelId}`, `Recorded stream: ${history.id}`,
    `Started: ${history.startedAt}`, `Ended: ${history.endedAt ?? 'Still recording'}`, '',
    `Recorded audience samples: ${summary.samples}`, `Peak observed viewers: ${available(summary.peakObservedViewers)}`,
    `Mean of observed viewer samples: ${available(summary.meanObservedViewers)}`,
    `Observed follower net change: ${available(summary.followerNetChange ?? null)}`,
    `Observed subscriber net change: ${available(summary.subscriberNetChange ?? null)}`, '',
    ...[...counts].sort(([left], [right]) => left.localeCompare(right)).map(([type, count]) => `- ${type}: ${count}`), '',
    `Collection gaps overlapping this stream: ${gaps.length}`,
    `Reviewed channel actions: ${intents.length}`,
    `Unconfirmed actions: ${intents.filter(item => item.status === 'uncertain' || item.status === 'sending').length}`, '',
    'Events without a Twitch stream ID are associated by this recorded channel and time interval.',
    'Retained and collected evidence only; missed events are not reconstructed.',
    'Chat presence is not verified video watch time. This report does not estimate revenue.',
  ].join('\n');
}
