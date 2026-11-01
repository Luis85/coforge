import type { Check } from './check';
import { durableBuildExecutionCheck } from './durable-build';
import { executionConcurrencyCheck } from './execution-concurrency';
import { boolean, list, number, oneOf, optional, record, shape, text, timestamp } from './check';
import { defaultIntegration, defaultSettings } from './seed';
import { obsSettingsCheck, obsCommandCheck } from './obs-check';
import { populationCheck } from './population-check';
import { stagePromptsCheck } from './stage-prompts';
import { stageUsageCheck } from './ai-usage';
import { stageAgentsCheck } from './stage-agents';
import { requestObjectDefinitionCheck } from './request-object';
import { workflowDefinitionCheck } from './configured-workflow';
import { configuredStepExecutionCheck } from './configured-workflow-run';
import type { AgentJob, AppState, Increment, IntegrationSettings, Settings } from './types';
import { CONTRIBUTOR_COLORS } from './types';
import { exampleRemovalCutoffsCheck, requestOriginsCheck } from './example-content';
import { obsShowStateCheck } from './obs-show-check';
import { obsSetupStateCheck } from './obs-setup-check';
import { twitchOperationsCheck } from './twitch-operations-validation';
import { agentConversationCheck } from './agent-conversation';
import { agentSessionTraceCheck } from './agent-session';
import { providerFailureInfoCheck } from './provider-failure';
import { workflowVerificationProfileCheck } from './native-workflow-tools';
import { workflowVerificationRecordsCheck, workflowVerificationRuntimeRecordsCheck } from './workflow-verification';
import { incrementStateCheck as increment } from './increment-state';
import { nativeWorkflowPrivateRuntimeCheck, nativeWorkflowProcessRecordCheck } from './native-workflow-process';
import { deletedRequestsCheck } from './request-deletion';

export interface IngestMeta { processedMessages: Array<{ id: string; ideaId?: string }>; lastRequests: Record<string, string>; chatRemovals?: import('./chat-removal').ChatRemovalHistory }
/** Everything except the idea notes. Stored as one JSON file in the plugin folder. */
export interface PersistedStudio extends Omit<AppState, 'ideas' | 'runtime' | 'projects'> {
  integration: IntegrationSettings; votes: Record<string, string[]>; increments: Record<string, Increment>;
  ingestMeta: IngestMeta; manualHolds: string[]; integrity: Record<string, string>;
}

const str = text();
const provider = oneOf(['demo', 'claude', 'herdr', 'codex'] as const);
const stage = oneOf(['screen', 'score', 'plan', 'implement'] as const);

function dictionary<T>(item: Check<T>): Check<Record<string, T>> {
  return (value, path = '') => Object.fromEntries(Object.entries(record(value, path)).map(([key, entry]) => [key, item(entry, `${path}.${key}`)]));
}

const job: Check<AgentJob> = shape({
  failure: optional(providerFailureInfoCheck),
  sessionTrace: optional(agentSessionTraceCheck),
  nativeRuntime: optional(nativeWorkflowPrivateRuntimeCheck),
  nativeProcess: optional(nativeWorkflowProcessRecordCheck),
  verification: optional(workflowVerificationRecordsCheck), verificationRuntime: optional(workflowVerificationRuntimeRecordsCheck),
  durable: optional(durableBuildExecutionCheck),
  conversation: optional(agentConversationCheck),
  workflow: optional(configuredStepExecutionCheck),
  usage: optional(stageUsageCheck), herdrAgent: optional(oneOf(['claude'] as const)),
  model: optional(text({ max: 100 })),
  id: str, ideaId: str, stage, status: oneOf(['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const), provider: oneOf(['demo', 'claude', 'herdr', 'codex', 'mcp'] as const),
  startedAt: timestamp, finishedAt: optional(timestamp), logs: list(str), error: optional(str), costUsd: optional(number({ min: 0 })),
  projectId: optional(str),
});
export const settingsCheck: Check<Settings> = shape({
  requestObject: optional(requestObjectDefinitionCheck),
  workflow: optional(workflowDefinitionCheck),
  herdrAgent: optional(oneOf(['claude'] as const)),
  stageAgents: optional(stageAgentsCheck),
  stagePrompts: optional(stagePromptsCheck),
  agentPrompt: text({ max: 8000 }),
  projectName: str, projectBrief: str, provider,
  automation: shape({ screen: boolean, score: boolean, plan: boolean, implement: boolean }), paused: boolean,
  intervalSeconds: number({ gt: 0 }), minVotes: number({ min: 0 }), maxTurns: number({ gt: 0 }), maxBudgetUsd: number({ gt: 0 }),
  timeoutSeconds: number({ gt: 0 }), model: str, requestCooldownSeconds: number({ min: 0 }),
});
const integration: Check<IntegrationSettings> = shape({
  workflowVerification: optional(workflowVerificationProfileCheck),
  executionConcurrency: optional(executionConcurrencyCheck),
  workerNodeBin: optional(text({ min: 1, max: 1000 })),
  codexBin: optional(text({ min: 1, max: 1000 })),
  ideasFolder: text({ min: 1 }), claudeBin: text({ min: 1 }), projectPath: str, allowImplementation: boolean, worktreeFolder: str,
  twitchEnabled: boolean, twitchClientId: str, twitchBotUserId: str, twitchBroadcasterId: str, twitchTokenSecret: str,
  twitchStreamerSecret: str, twitchBotUsesStreamer: boolean, twitchBotReplies: boolean,
  publicFolder: text({ min: 1 }), publicBoardEnabled: boolean,
});
const persisted: Check<PersistedStudio> = shape({
  deletedRequests: optional(deletedRequestsCheck),
  workflowStopHolds: optional(list(text({ pattern: /^CF-\d{3,7}$/ }))),
  obsShow: optional(obsShowStateCheck),
  obsSetup: optional(obsSetupStateCheck),
  twitchOperations: optional(twitchOperationsCheck),
  requestOrigins: optional(requestOriginsCheck),
  exampleRemovalCutoffs: optional(exampleRemovalCutoffsCheck),
  sampleEventIds: optional(list(text({ min: 1, max: 100 }))),
  sampleCreatedProjectIds: optional(list(text({ pattern: /^CFP-\d{3,7}$/ }))),
  setupGuide: optional(shape({ dismissed: boolean, completedAt: optional(timestamp) })),
  obsSettings: optional(obsSettingsCheck), obsCommand: optional(obsCommandCheck), obsResumeSceneId: optional(str),
  population: optional(populationCheck),
  streamMessages: optional(list(shape({ id: str, text: str, intervalMinutes: number({ integer: true, min: 1, max: 240 }), active: boolean,
    channelId: str, createdAt: timestamp, updatedAt: timestamp, streamKey: optional(str), nextDueAt: optional(timestamp), lastQueuedAt: optional(timestamp), lastSentAt: optional(timestamp), lastError: optional(str) }))),
  version: oneOf([1] as const), nextIdeaNumber: number({ integer: true, gt: 0 }),
  activeProjectId: optional(str),
  nextProjectNumber: optional(number({ integer: true, gt: 0 })),
  contributors: list(shape({ id: str, name: str, color: oneOf(CONTRIBUTOR_COLORS), joinedAt: timestamp })),
  chat: list(shape({
    id: str, userId: str, username: str, text: str, createdAt: timestamp, kind: oneOf(['message', 'request', 'context', 'vote', 'system', 'error'] as const),
    ideaId: optional(str), source: oneOf(['simulator', 'twitch', 'api'] as const),
    externalId: optional(str),
    twitchChannelId: optional(str),
  })),
  jobs: list(job),
  events: list(shape({ id: str, ideaId: optional(str), type: oneOf(['idea', 'vote', 'agent', 'review', 'system'] as const), text: str, createdAt: timestamp })),
  settings: settingsCheck, integration, votes: dictionary(list(str)), increments: dictionary(increment),
  botReplies: optional(list(shape({ id: str, parentMessageId: optional(str), channelId: str, senderId: str, text: str, createdAt: timestamp, streamMessageId: optional(str), streamKey: optional(str),
    publicProjectIds: optional(list(text({ pattern: /^CFP-\d{3,7}$/ }), { max: 100 })),
    reviewedAt: optional(timestamp), greetingPlayerId: optional(str),
    status: oneOf(['pending', 'sending', 'sent', 'failed', 'uncertain', 'cancelled'] as const), messageId: optional(str), error: optional(str) }))),
  ingestMeta: shape({ processedMessages: list(shape({ id: str, ideaId: optional(str) })), lastRequests: dictionary(timestamp), chatRemovals: optional(shape({ channelId: str, messages: list(str, { max: 1000 }), clearAt: optional(timestamp), users: list(shape({ id: str, at: timestamp }), { max: 1000 }) })) }),
  manualHolds: list(str), integrity: dictionary(str),
});

/** Validates stored studio data. Missing optional sections receive defaults; invalid data is rejected, never replaced. */
export function parsePersistedStudio(value: unknown): PersistedStudio {
  const input = record(value);
  return persisted({
    ...input,
    settings: { ...defaultSettings(), ...record(input.settings ?? {}, 'settings') },
    integration: { ...defaultIntegration(), ...record(input.integration ?? {}, 'integration'),
      twitchBotUsesStreamer: record(input.integration ?? {}).twitchBotUsesStreamer
        ?? !(record(input.integration ?? {}).twitchBotUserId && record(input.integration ?? {}).twitchBotUserId !== record(input.integration ?? {}).twitchBroadcasterId) },
    votes: input.votes ?? {}, increments: input.increments ?? {}, manualHolds: input.manualHolds ?? [], integrity: input.integrity ?? {},
    ingestMeta: input.ingestMeta ?? { processedMessages: [], lastRequests: {} },
  });
}
