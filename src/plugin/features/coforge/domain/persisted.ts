import type { Check } from './check';
import { boolean, list, number, oneOf, optional, record, shape, text, timestamp } from './check';
import { defaultIntegration, defaultSettings } from './seed';
import type { AgentJob, AppState, Increment, IntegrationSettings, Settings } from './types';
import { CONTRIBUTOR_COLORS } from './types';

export interface IngestMeta { processedMessages: Array<{ id: string; ideaId?: string }>; lastRequests: Record<string, string> }
/** Everything except the idea notes. Stored as one JSON file in the plugin folder. */
export interface PersistedStudio extends Omit<AppState, 'ideas' | 'runtime'> {
  integration: IntegrationSettings; votes: Record<string, string[]>; increments: Record<string, Increment>;
  ingestMeta: IngestMeta; manualHolds: string[]; integrity: Record<string, string>;
}

const str = text();
const provider = oneOf(['demo', 'claude'] as const);
const stage = oneOf(['screen', 'score', 'plan', 'implement'] as const);

function dictionary<T>(item: Check<T>): Check<Record<string, T>> {
  return (value, path = '') => Object.fromEntries(Object.entries(record(value, path)).map(([key, entry]) => [key, item(entry, `${path}.${key}`)]));
}

const increment = shape({
  summary: str, files: list(shape({ path: str, additions: number({ min: 0 }), deletions: number({ min: 0 }) })), tests: list(str), diff: str,
  branch: optional(str), worktree: optional(str), commit: optional(str), createdAt: timestamp, simulated: boolean,
});
const job: Check<AgentJob> = shape({
  id: str, ideaId: str, stage, status: oneOf(['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const), provider,
  startedAt: timestamp, finishedAt: optional(timestamp), logs: list(str), error: optional(str), costUsd: optional(number({ min: 0 })),
});
const settings: Check<Settings> = shape({
  projectName: str, projectBrief: str, provider,
  automation: shape({ screen: boolean, score: boolean, plan: boolean, implement: boolean }), paused: boolean,
  intervalSeconds: number({ gt: 0 }), minVotes: number({ min: 0 }), maxTurns: number({ gt: 0 }), maxBudgetUsd: number({ gt: 0 }),
  timeoutSeconds: number({ gt: 0 }), model: str, requestCooldownSeconds: number({ min: 0 }),
});
const integration: Check<IntegrationSettings> = shape({
  ideasFolder: text({ min: 1 }), claudeBin: text({ min: 1 }), projectPath: str, allowImplementation: boolean, worktreeFolder: str,
  twitchEnabled: boolean, twitchClientId: str, twitchBotUserId: str, twitchBroadcasterId: str, twitchTokenSecret: str,
  publicFolder: text({ min: 1 }), publicBoardEnabled: boolean,
});
const persisted: Check<PersistedStudio> = shape({
  version: oneOf([1] as const), nextIdeaNumber: number({ integer: true, gt: 0 }),
  contributors: list(shape({ id: str, name: str, color: oneOf(CONTRIBUTOR_COLORS), joinedAt: timestamp })),
  chat: list(shape({
    id: str, userId: str, username: str, text: str, createdAt: timestamp, kind: oneOf(['message', 'request', 'vote', 'system', 'error'] as const),
    ideaId: optional(str), source: oneOf(['simulator', 'twitch', 'api'] as const),
  })),
  jobs: list(job),
  events: list(shape({ id: str, ideaId: optional(str), type: oneOf(['idea', 'vote', 'agent', 'review', 'system'] as const), text: str, createdAt: timestamp })),
  settings, integration, votes: dictionary(list(str)), increments: dictionary(increment),
  ingestMeta: shape({ processedMessages: list(shape({ id: str, ideaId: optional(str) })), lastRequests: dictionary(timestamp) }),
  manualHolds: list(str), integrity: dictionary(str),
});

/** Validates stored studio data. Missing optional sections receive defaults; invalid data is rejected, never replaced. */
export function parsePersistedStudio(value: unknown): PersistedStudio {
  const input = record(value);
  return persisted({
    ...input,
    settings: { ...defaultSettings(), ...record(input.settings ?? {}, 'settings') },
    integration: { ...defaultIntegration(), ...record(input.integration ?? {}, 'integration') },
    votes: input.votes ?? {}, increments: input.increments ?? {}, manualHolds: input.manualHolds ?? [], integrity: input.integrity ?? {},
    ingestMeta: input.ingestMeta ?? { processedMessages: [], lastRequests: {} },
  });
}
