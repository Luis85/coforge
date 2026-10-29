import { boolean, CheckError, list, number, oneOf, optional, record, shape, text, timestamp, type Check } from './check';
import { TWITCH_ACTIONS } from './twitch-operations-catalogue';
import { TWITCH_ACTION_NAMES, type TwitchAction, type TwitchOperationField, type TwitchOperationsState, type TwitchValue } from './twitch-operations';

/** A management grant also permits its matching read endpoint. */
export function twitchScopeGranted(scopes: readonly string[], scope: string): boolean {
  if (scopes.includes(scope)) return true;
  const alternatives: Record<string, string> = { 'moderation:read': 'channel:manage:moderators', 'channel:read:broadcast': 'channel:manage:broadcast' };
  return scopes.includes(alternatives[scope] ?? scope.replace(':read:', ':manage:'));
}

function parameter(value: unknown, field: TwitchOperationField): TwitchValue {
  const path = field.name;
  if (field.type === 'boolean') return boolean(value, path);
  if (field.type === 'number') return number({ integer: true, min: field.min, max: field.max })(value, path);
  if (field.type === 'list') {
    const result = list(text({ trim: true, min: 1, max: 25 }), { min: field.min, max: field.max })(value, path);
    if (new Set(result.map(item => item.toLocaleLowerCase('en-US'))).size !== result.length) throw new CheckError(path, 'use distinct choices');
    return result;
  }
  if (field.type === 'select') return oneOf(field.options ?? [])(value, path);
  const result = text({ trim: true, min: field.required ? field.min ?? 1 : field.min, max: field.max ?? 500 })(value, path);
  if (['user_id', 'to_broadcaster_id', 'category_id'].includes(path) && result && !/^\d{1,40}$/.test(result)) throw new CheckError(path, 'must be a numeric Twitch ID');
  if (path.includes('_time') && result && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result)))) throw new CheckError(path, 'must be an ISO 8601 date and time with a timezone');
  if (path === 'timezone' && result) {
    try { new Intl.DateTimeFormat('en', { timeZone: result }).format(); }
    catch { throw new CheckError(path, 'must be a valid IANA timezone'); }
  }
  return result;
}

export function validateTwitchAction(input: unknown): TwitchAction {
  const value = record(input); const name = oneOf(TWITCH_ACTION_NAMES)(value.name, 'name');
  const descriptor = TWITCH_ACTIONS.find(item => item.name === name);
  if (!descriptor) throw new CheckError('name', 'unknown Twitch action');
  const values = record(value.parameters, 'parameters'); const parameters: Record<string, TwitchValue> = {};
  for (const key of Object.keys(values)) if (!descriptor.fields.some(field => field.name === key)) throw new CheckError(key, 'is not allowed');
  for (const field of descriptor.fields) {
    if (values[field.name] === undefined) { if (field.required) throw new CheckError(field.name, 'is required'); continue; }
    parameters[field.name] = parameter(values[field.name], field);
  }
  if (name === 'prediction-end' && parameters.status === 'RESOLVED' && !parameters.winning_outcome_id) throw new CheckError('winning_outcome_id', 'choose the winning outcome before distributing points');
  if (name === 'chat-settings' && !Object.keys(parameters).length) throw new CheckError('parameters', 'select a chat setting to change');
  if (name === 'chat-settings' && parameters.slow_mode === true && parameters.slow_mode_wait_time === undefined) throw new CheckError('slow_mode_wait_time', 'is required when slow mode is enabled');
  if (name === 'chat-settings' && parameters.slow_mode_wait_time !== undefined && parameters.slow_mode !== true) throw new CheckError('slow_mode', 'enable slow mode when setting its delay');
  if (name === 'chat-settings' && parameters.follower_mode === true && parameters.follower_mode_duration === undefined) throw new CheckError('follower_mode_duration', 'is required when follower mode is enabled');
  if (name === 'chat-settings' && parameters.follower_mode_duration !== undefined && parameters.follower_mode !== true) throw new CheckError('follower_mode', 'enable follower mode when setting its duration');
  if (name === 'schedule-update' && Object.keys(parameters).length < 2) throw new CheckError('parameters', 'select a published broadcast property to change');
  if (name === 'reward-create' || name === 'reward-update') {
    for (const [enabled, count] of [['is_global_cooldown_enabled', 'global_cooldown_seconds'], ['is_max_per_stream_enabled', 'max_per_stream'], ['is_max_per_user_per_stream_enabled', 'max_per_user_per_stream']]) if (parameters[enabled!] === true && parameters[count!] === undefined) throw new CheckError(count!, 'is required when its limit is enabled');
    if (name === 'reward-update' && Object.keys(parameters).length < 2) throw new CheckError('parameters', 'select a reward property to change');
  }
  if (name === 'schedule-vacation' && parameters.is_vacation_enabled === true) {
    for (const key of ['vacation_start_time', 'vacation_end_time', 'timezone']) if (!parameters[key]) throw new CheckError(key, 'is required for vacation');
    if (Date.parse(String(parameters.vacation_end_time)) <= Date.parse(String(parameters.vacation_start_time))) throw new CheckError('vacation_end_time', 'must be after the start');
  }
  for (const [key, content] of Object.entries(parameters)) if (typeof content === 'string' && Array.from(content).some(character => {
    const code = character.charCodeAt(0); return code < 32 && ![9, 10, 13].includes(code);
  })) throw new CheckError(key, 'contains invalid control characters');
  return { name, parameters };
}

const action: Check<TwitchAction> = validateTwitchAction;
export const twitchDetailsCheck: Check<Record<string, TwitchValue>> = (value, path = 'details') => {
  const input = record(value, path); const output: Record<string, TwitchValue> = {};
  if (Object.keys(input).length > 30) throw new CheckError(path, 'allows at most 30 fields');
  for (const [key, entry] of Object.entries(input)) {
    if (!/^[a-zA-Z0-9_]{1,50}$/.test(key)) throw new CheckError(path, 'invalid detail name');
    output[key] = typeof entry === 'string' ? text({ max: 2000 })(entry, path) : typeof entry === 'boolean' ? entry : typeof entry === 'number' ? number()(entry, path) : list(text({ max: 200 }), { max: 20 })(entry, path);
  }
  return output;
};
const activity = shape({ id: text({ min: 1, max: 200 }), channelId: text({ pattern: /^\d{1,40}$/ }), type: text({ min: 1, max: 100 }), at: timestamp, summary: text({ max: 1000 }), actorId: optional(text({ max: 100 })), actorName: optional(text({ max: 100 })), amount: optional(number({ min: 0 })), acknowledgedAt: optional(timestamp), streamId: optional(text({ max: 100 })), details: optional(twitchDetailsCheck), linkedIdeaId: optional(text({ pattern: /^CF-\d+$/ })), linkedProjectId: optional(text({ pattern: /^CFP-\d+$/ })) });
const intent = shape({ id: text({ min: 1, max: 100 }), channelId: text({ pattern: /^\d{1,40}$/ }), accountId: text({ pattern: /^\d{1,40}$/ }), clientId: text({ min: 1, max: 100 }), action, createdAt: timestamp, status: oneOf(['sending', 'confirmed', 'failed', 'uncertain'] as const), finishedAt: optional(timestamp), error: optional(text({ max: 1000 })), reviewedAt: optional(timestamp), reviewNote: optional(text({ max: 1000 })), receipt: optional(twitchDetailsCheck), completion: optional(oneOf(['accepted', 'completed'] as const)) });
export const twitchOperationsCheck: Check<TwitchOperationsState> = shape({ activities: list(activity, { max: 2000 }), intents: list(intent, { max: 1000 }), gaps: list(shape({ channelId: text({ pattern: /^\d{1,40}$/ }), startedAt: timestamp, endedAt: optional(timestamp), reason: text({ max: 250 }) }), { max: 500 }), retentionDays: number({ integer: true, min: 1, max: 365 }), templates: optional(list(shape({ id: text({ min: 1, max: 100 }), name: text({ min: 1, max: 100 }), action, updatedAt: timestamp }), { max: 100 })) });
