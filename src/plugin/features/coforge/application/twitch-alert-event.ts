import type { StudioEvent } from './studio-events';
import type { AppState } from '../domain/types';
import type { TwitchActivity } from '../domain/twitch-operations';
import { alertEventVariables, type TwitchAlertEvent } from '../domain/alerts';
import { projectIsPublic } from '../domain/project-publicity';
import { ideaProjectId } from '../domain/projects';
import { buildPublicBoard } from '../domain/public-board';
import { cleanLine } from '../domain/sanitize';

export const TWITCH_ALERT_MAX_AGE_MS = 120_000;
export interface TwitchAlertContext { channelId: string; enabled: boolean; startedAt: number; now: number }
export interface PublicTwitchAlert { type: TwitchAlertEvent; identity: string; variables: Record<string, string> }

/** Linking an activity never grants publication access to its private analytical context. */
export function twitchActivityIsPublic(activity: TwitchActivity, state: AppState): boolean {
  if (activity.linkedProjectId && !projectIsPublic(state, activity.linkedProjectId)) return false;
  if (!activity.linkedIdeaId) return true;
  const idea = state.ideas.find(item => item.id === activity.linkedIdeaId);
  if (!idea || activity.linkedProjectId && ideaProjectId(idea) !== activity.linkedProjectId) return false;
  return buildPublicBoard({ ...state, activeProjectId: ideaProjectId(idea) }).columns.some(column => column.ideas.some(item => item.id === idea.id));
}

function alertType(activity: TwitchActivity): TwitchAlertEvent | undefined {
  if (activity.type === 'channel.raid') {
    if (activity.details?.raid_direction === 'incoming') return 'channel.raid.incoming';
    if (activity.details?.raid_direction === 'outgoing') return 'channel.raid.outgoing';
    return undefined;
  }
  const types: readonly TwitchAlertEvent[] = ['channel.follow', 'channel.subscribe', 'channel.subscription.gift', 'channel.subscription.message', 'channel.cheer', 'channel.channel_points_custom_reward_redemption.add', 'stream.online', 'stream.offline'];
  return types.find(type => type === activity.type);
}

/** Whitelist only a newly committed, current-channel public fact, never retained history or raw EventSub details. */
export function publicTwitchAlert(event: StudioEvent, state: AppState, context: TwitchAlertContext): PublicTwitchAlert | null {
  if (event.type !== 'twitch-activity-observed' || event.record.effect !== 'committed' || !context.enabled || !/^\d{1,40}$/.test(context.channelId)) return null;
  const activity = state.twitchOperations?.activities.find(item => item.id === event.record.entityId && item.channelId === context.channelId);
  if (!activity || state.runtime.twitch?.channel && state.runtime.twitch.channel.id !== context.channelId) return null;
  const at = Date.parse(activity.at); const observed = Date.parse(event.record.at);
  if (!Number.isFinite(at) || !Number.isFinite(observed) || at < context.startedAt || observed < context.startedAt
    || context.now - at > TWITCH_ALERT_MAX_AGE_MS || at - context.now > 30_000
    || context.now - observed > TWITCH_ALERT_MAX_AGE_MS || observed - context.now > 30_000) return null;
  if (state.twitchOperations?.gaps.some(gap => gap.channelId === context.channelId && at >= Date.parse(gap.startedAt) && (!gap.endedAt || at < Date.parse(gap.endedAt)))) return null;
  const type = alertType(activity);
  if (!type || !twitchActivityIsPublic(activity, state)) return null;
  const allowed = alertEventVariables(type);
  const variables: Record<string, string> = { event: type, count: '1' };
  const anonymousCapable = type === 'channel.cheer' || type === 'channel.subscription.gift';
  const named = anonymousCapable ? activity.details?.is_anonymous === false : activity.details?.is_anonymous !== true;
  if (allowed.includes('viewer') && named && activity.actorName) {
    const viewer = cleanLine(activity.actorName, 100); if (viewer) variables.viewer = viewer;
  }
  if (allowed.includes('amount') && activity.amount !== undefined && Number.isSafeInteger(activity.amount) && activity.amount >= 0) variables.amount = String(activity.amount);
  if (type === 'channel.channel_points_custom_reward_redemption.add' && typeof activity.details?.reward_title === 'string') {
    const reward = cleanLine(activity.details.reward_title, 45); if (reward) variables.reward = reward;
  }
  return { type, identity: `twitch:${context.channelId}:${activity.id}`, variables };
}
