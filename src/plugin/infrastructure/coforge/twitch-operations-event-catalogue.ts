import type { TwitchResource } from '../../features/coforge/domain/twitch-operations';
import { twitchScopeGranted } from '../../features/coforge/domain/twitch-operations-validation';
import type { TwitchEventSubscription } from './twitch';

export interface OperationsEventDefinition {
  type: string; resources: readonly TwitchResource[]; scope?: string; version?: string; condition?: 'moderator' | 'incoming-raid' | 'outgoing-raid' | 'chat-user';
}
const activity: readonly TwitchResource[] = ['activity'];
const definitions: OperationsEventDefinition[] = [
  { type: 'stream.online', resources: activity },
  { type: 'stream.offline', resources: activity },
  { type: 'channel.update', resources: activity, version: '2' },
  { type: 'channel.follow', resources: ['activity', 'followers'], scope: 'moderator:read:followers', version: '2', condition: 'moderator' },
  ...['channel.subscribe', 'channel.subscription.end', 'channel.subscription.gift', 'channel.subscription.message'].map(type => ({ type, resources: ['activity', 'subscribers'] satisfies TwitchResource[], scope: 'channel:read:subscriptions' })),
  { type: 'channel.cheer', resources: ['activity', 'bits'], scope: 'bits:read' },
  { type: 'channel.raid', resources: activity, condition: 'incoming-raid' },
  { type: 'channel.raid', resources: activity, condition: 'outgoing-raid' },
  { type: 'channel.ad_break.begin', resources: ['activity', 'ads'], scope: 'channel:read:ads' },
  ...['channel.ban', 'channel.unban'].map(type => ({ type, resources: activity, scope: 'channel:moderate' })),
  ...['channel.warning.send', 'channel.warning.acknowledge'].map(type => ({ type, resources: activity, scope: 'moderator:read:warnings', condition: 'moderator' as const })),
  ...['channel.unban_request.create', 'channel.unban_request.resolve'].map(type => ({ type, resources: ['activity', 'unban-requests'] satisfies TwitchResource[], scope: 'moderator:read:unban_requests', condition: 'moderator' as const })),
  ...['channel.shield_mode.begin', 'channel.shield_mode.end'].map(type => ({ type, resources: ['activity', 'shield'] satisfies TwitchResource[], scope: 'moderator:read:shield_mode', condition: 'moderator' as const })),
  ...['automod.message.hold', 'automod.message.update'].map(type => ({ type, resources: ['automod-queue'] satisfies TwitchResource[], scope: 'moderator:manage:automod', version: '2', condition: 'moderator' as const })),
  { type: 'automod.settings.update', resources: ['automod-settings'], scope: 'moderator:read:automod_settings', condition: 'moderator' },
  { type: 'automod.terms.update', resources: ['blocked-terms'], scope: 'moderator:manage:automod', condition: 'moderator' },
  { type: 'channel.chat_settings.update', resources: ['chat-settings'], scope: 'user:read:chat', condition: 'chat-user' },
  ...['add', 'update', 'remove'].map(suffix => ({ type: `channel.channel_points_custom_reward.${suffix}`, resources: ['rewards'] satisfies TwitchResource[], scope: 'channel:read:redemptions' })),
  ...['add', 'update'].map(suffix => ({ type: `channel.channel_points_custom_reward_redemption.${suffix}`, resources: ['activity', 'redemptions'] satisfies TwitchResource[], scope: 'channel:read:redemptions' })),
  ...['begin', 'progress', 'end'].map(suffix => ({ type: `channel.poll.${suffix}`, resources: ['polls'] satisfies TwitchResource[], scope: 'channel:read:polls' })),
  ...['begin', 'progress', 'lock', 'end'].map(suffix => ({ type: `channel.prediction.${suffix}`, resources: ['predictions'] satisfies TwitchResource[], scope: 'channel:read:predictions' })),
  ...['begin', 'progress', 'end'].map(suffix => ({ type: `channel.goal.${suffix}`, resources: ['goals'] satisfies TwitchResource[], scope: 'channel:read:goals' })),
  ...['begin', 'progress', 'end'].map(suffix => ({ type: `channel.hype_train.${suffix}`, resources: ['activity', 'hype-train'] satisfies TwitchResource[], scope: 'channel:read:hype_train', version: '2' })),
  ...['start', 'progress', 'stop', 'donate'].map(suffix => ({ type: `channel.charity_campaign.${suffix}`, resources: ['activity', 'charity'] satisfies TwitchResource[], scope: 'channel:read:charity' })),
];
export const TWITCH_OPERATIONS_EVENT_TYPES: readonly string[] = definitions.map(item => item.type);

export function operationsEventScopes(resource: TwitchResource): string[] {
  return [...new Set(definitions.filter(item => item.resources.includes(resource)).flatMap(item => item.scope ? [item.scope] : []))];
}
export function operationsEventResources(type: string): TwitchResource[] {
  return [...new Set(definitions.filter(item => item.type === type).flatMap(item => item.resources))];
}

export function operationsEventSubscriptions(resources: readonly TwitchResource[], scopes: readonly string[], channel: string): TwitchEventSubscription[] {
  return definitions.filter(item => item.resources.some(resource => resources.includes(resource)) && (!item.scope || twitchScopeGranted(scopes, item.scope))).map(item => {
    const condition: Record<string, string> = item.condition === 'incoming-raid' ? { to_broadcaster_user_id: channel }
      : item.condition === 'outgoing-raid' ? { from_broadcaster_user_id: channel }
      : item.condition === 'moderator' ? { broadcaster_user_id: channel, moderator_user_id: channel }
      : item.condition === 'chat-user' ? { broadcaster_user_id: channel, user_id: channel } : { broadcaster_user_id: channel };
    return { type: item.type, version: item.version ?? '1', condition };
  });
}
