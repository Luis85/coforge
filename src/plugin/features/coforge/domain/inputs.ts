import { boolean, number, oneOf, optional, shape, text } from './check';
import { categoryNameCheck } from './request-categories';
import { stagePromptsCheck } from './stage-prompts';
import { agentModelCheck, stageAgentsCheck } from './stage-agents';
import { workflowDefinitionCheck } from './configured-workflow';
import { executionConcurrencyCheck } from './execution-concurrency';
import { normalizeVaultFolder } from './vault-folder-policy';
import { requestObjectDefinitionCheck, requestValuesInputCheck } from './request-object';
import { workflowVerificationProfileCheck } from './native-workflow-tools';

const username = text({ trim: true, min: 1, max: 50 });

export const chatInput = shape({
  username, userId: optional(text({ trim: true, min: 1, max: 100 })), text: text({ trim: true, min: 1, max: 2000 }),
  messageId: optional(text({ min: 1, max: 200 })),
});

export const newIdeaInput = shape({
  projectId: optional(text({ pattern: /^CFP-\d{3,7}$/u })),
  requestValues: optional(requestValuesInputCheck),
  requestObjectRevision: optional(text({ min: 1, max: 100 })),
  requestKind: optional(oneOf(['feature', 'bug'] as const)),
  title: text({ trim: true, min: 5, max: 120 }), description: text({ trim: true, max: 3000 }),
  category: categoryNameCheck, username,
});

export const riceInput = shape({
  reach: number({ integer: true, min: 0, max: 1_000_000 }), impact: number({ min: 0.25, max: 3 }),
  confidence: number({ min: 0, max: 1 }), effort: number({ min: 0.1, max: 365 }), rationale: text({ trim: true, min: 3, max: 3000 }),
}, { strict: true });

export const settingsPatch = shape({
  requestObject: optional(requestObjectDefinitionCheck),
  workflow: optional(workflowDefinitionCheck),
  herdrAgent: optional(oneOf(['claude'] as const)),
  stageAgents: optional(stageAgentsCheck),
  stagePrompts: optional(stagePromptsCheck),
  agentPrompt: optional(text({ trim: true, max: 8000 })),
  projectName: optional(text({ trim: true, min: 1, max: 80 })), projectBrief: optional(text({ trim: true, min: 10, max: 8000 })),
  provider: optional(oneOf(['demo', 'claude', 'herdr', 'codex'] as const)),
  automation: optional(shape({ screen: optional(boolean), score: optional(boolean), plan: optional(boolean), implement: optional(boolean) }, { strict: true })),
  paused: optional(boolean), intervalSeconds: optional(number({ integer: true, min: 2, max: 3600 })),
  minVotes: optional(number({ integer: true, min: 0, max: 10000 })), maxTurns: optional(number({ integer: true, min: 1, max: 50 })),
  maxBudgetUsd: optional(number({ min: 0.1, max: 20 })), timeoutSeconds: optional(number({ integer: true, min: 15, max: 1800 })),
  model: optional(agentModelCheck),
  requestCooldownSeconds: optional(number({ integer: true, min: 0, max: 600 })),
}, { strict: true });

const folder = normalizeVaultFolder;
const pathText = text({ trim: true, max: 1000 });
const twitchId = text({ trim: true, max: 100, pattern: /^[\w-]*$/ });

export const integrationPatch = shape({
  workflowVerification: optional(workflowVerificationProfileCheck),
  executionConcurrency: optional(executionConcurrencyCheck),
  workerNodeBin: optional(text({ trim: true, min: 1, max: 1000 })),
  codexBin: optional(text({ trim: true, min: 1, max: 1000 })),
  ideasFolder: optional(folder), claudeBin: optional(text({ trim: true, min: 1, max: 1000 })), projectPath: optional(pathText),
  allowImplementation: optional(boolean), worktreeFolder: optional(pathText), twitchEnabled: optional(boolean),
  twitchClientId: optional(twitchId), twitchBotUserId: optional(twitchId), twitchBroadcasterId: optional(twitchId),
  twitchTokenSecret: optional(text({ trim: true, min: 1, max: 64, pattern: /^[a-z0-9-]+$/ })),
  twitchStreamerSecret: optional(text({ trim: true, min: 1, max: 64, pattern: /^[a-z0-9-]+$/ })), twitchBotUsesStreamer: optional(boolean),
  twitchBotReplies: optional(boolean),
  publicFolder: optional(folder), publicBoardEnabled: optional(boolean),
}, { strict: true });
