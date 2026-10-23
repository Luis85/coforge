import { boolean, number, oneOf, optional, shape, text } from './check';
import { CATEGORIES } from './types';

const username = text({ trim: true, min: 1, max: 50 });

export const chatInput = shape({
  username, userId: optional(text({ trim: true, min: 1, max: 100 })), text: text({ trim: true, min: 1, max: 2000 }),
  messageId: optional(text({ min: 1, max: 200 })),
});

export const newIdeaInput = shape({
  title: text({ trim: true, min: 5, max: 120 }), description: text({ trim: true, max: 3000 }),
  category: oneOf(CATEGORIES), username,
});

export const riceInput = shape({
  reach: number({ integer: true, min: 0, max: 1_000_000 }), impact: number({ min: 0.25, max: 3 }),
  confidence: number({ min: 0, max: 1 }), effort: number({ min: 0.1, max: 365 }), rationale: text({ trim: true, min: 3, max: 3000 }),
}, { strict: true });

export const settingsPatch = shape({
  projectName: optional(text({ trim: true, min: 1, max: 80 })), projectBrief: optional(text({ trim: true, min: 10, max: 8000 })),
  provider: optional(oneOf(['demo', 'claude'] as const)),
  automation: optional(shape({ screen: optional(boolean), score: optional(boolean), plan: optional(boolean), implement: optional(boolean) }, { strict: true })),
  paused: optional(boolean), intervalSeconds: optional(number({ integer: true, min: 2, max: 3600 })),
  minVotes: optional(number({ integer: true, min: 0, max: 10000 })), maxTurns: optional(number({ integer: true, min: 1, max: 50 })),
  maxBudgetUsd: optional(number({ min: 0.1, max: 20 })), timeoutSeconds: optional(number({ integer: true, min: 15, max: 1800 })),
  model: optional(text({ trim: true, min: 1, max: 100, pattern: /^[a-zA-Z0-9._:-]+$/ })),
  requestCooldownSeconds: optional(number({ integer: true, min: 0, max: 600 })),
}, { strict: true });

const folder = text({ trim: true, min: 1, max: 200, pattern: /^(?!\/)(?!.*\.\.)[^\\:*?"<>|]+$/ });
const pathText = text({ trim: true, max: 1000 });
const twitchId = text({ trim: true, max: 100, pattern: /^[\w-]*$/ });

export const integrationPatch = shape({
  ideasFolder: optional(folder), claudeBin: optional(text({ trim: true, min: 1, max: 1000 })), projectPath: optional(pathText),
  allowImplementation: optional(boolean), worktreeFolder: optional(pathText), twitchEnabled: optional(boolean),
  twitchClientId: optional(twitchId), twitchBotUserId: optional(twitchId), twitchBroadcasterId: optional(twitchId),
  twitchTokenSecret: optional(text({ trim: true, min: 1, max: 64, pattern: /^[a-z0-9-]+$/ })),
}, { strict: true });
