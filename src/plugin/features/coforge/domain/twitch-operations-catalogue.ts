import type { TwitchActionDescriptor, TwitchOperationField, TwitchResourceDescriptor } from './twitch-operations';

const field = (name: string, label: string, type: TwitchOperationField['type'] = 'text', options: Omit<TwitchOperationField, 'name' | 'label' | 'type'> = {}): TwitchOperationField => ({ name, label, type, required: true, ...options });
const id = (name: string, label: string) => field(name, label, 'text', { max: 100 });
const segmentId = field('id', 'Schedule segment ID', 'text', { max: 1024 });
const user = id('user_id', 'Twitch user ID');
const reward = id('reward_id', 'Reward ID');
const status = (options: readonly string[]) => field('status', 'Outcome', 'select', { options });
const message = field('message', 'Message', 'text', { max: 500 });
const rewardFields = [field('title', 'Reward title', 'text', { max: 45 }), field('cost', 'Channel Points cost', 'number', { min: 1 }), field('prompt', 'Viewer prompt', 'text', { required: false, max: 200 }), field('is_enabled', 'Available to viewers', 'boolean', { required: false }), field('is_paused', 'Pause redemptions', 'boolean', { required: false }), field('is_user_input_required', 'Require viewer text', 'boolean', { required: false }), field('is_global_cooldown_enabled', 'Enable cooldown', 'boolean', { required: false }), field('global_cooldown_seconds', 'Cooldown seconds', 'number', { required: false, min: 1 }), field('is_max_per_stream_enabled', 'Limit redemptions per stream', 'boolean', { required: false }), field('max_per_stream', 'Maximum per stream', 'number', { required: false, min: 1 }), field('is_max_per_user_per_stream_enabled', 'Limit per viewer per stream', 'boolean', { required: false }), field('max_per_user_per_stream', 'Maximum per viewer per stream', 'number', { required: false, min: 1 })];
const scheduleFields = [field('title', 'Broadcast title', 'text', { max: 140 }), field('start_time', 'Start time (ISO 8601)', 'text', { max: 50 }), field('timezone', 'IANA timezone', 'text', { max: 100 }), field('duration', 'Duration in minutes', 'number', { min: 30, max: 1380 }), field('category_id', 'Category ID', 'text', { required: false, max: 30 }), field('is_recurring', 'Repeat weekly', 'boolean', { required: false })];
const appOwned = 'Only rewards created with this Twitch application can be changed or have redemptions managed. Affiliate or Partner eligibility applies.';
export const TWITCH_ACTIONS: readonly TwitchActionDescriptor[] = [
  { name: 'chat-settings', label: 'Update chat modes', resource: 'chat-settings', scopes: ['moderator:manage:chat_settings'], fields: [field('slow_mode', 'Slow mode', 'boolean', { required: false }), field('slow_mode_wait_time', 'Slow mode seconds', 'number', { required: false, min: 3, max: 120 }), field('follower_mode', 'Followers only', 'boolean', { required: false }), field('follower_mode_duration', 'Minimum follow minutes', 'number', { required: false, min: 0, max: 129600 }), field('subscriber_mode', 'Subscribers only', 'boolean', { required: false }), field('emote_mode', 'Emotes only', 'boolean', { required: false }), field('unique_chat_mode', 'Unique messages only', 'boolean', { required: false })] },
  { name: 'automod-settings', label: 'Update AutoMod level', resource: 'automod-settings', scopes: ['moderator:manage:automod_settings'], fields: [field('overall_level', 'AutoMod level', 'number', { min: 0, max: 4 })] },
  { name: 'automod-resolve', label: 'Review held message', resource: 'automod-queue', scopes: ['moderator:manage:automod'], fields: [id('msg_id', 'Held message ID'), field('action', 'Decision', 'select', { options: ['ALLOW', 'DENY'] })] },
  { name: 'blocked-term-add', label: 'Add blocked term', resource: 'blocked-terms', scopes: ['moderator:manage:blocked_terms'], fields: [field('text', 'Blocked term', 'text', { min: 2, max: 500 })] },
  { name: 'blocked-term-remove', label: 'Remove blocked term', resource: 'blocked-terms', scopes: ['moderator:manage:blocked_terms'], fields: [id('id', 'Blocked term ID')] },
  { name: 'warn', label: 'Warn viewer', resource: 'activity', scopes: ['moderator:manage:warnings'], fields: [user, field('reason', 'Warning reason', 'text', { max: 500 })] },
  { name: 'unban-request-resolve', label: 'Resolve unban request', resource: 'unban-requests', scopes: ['moderator:manage:unban_requests'], fields: [id('unban_request_id', 'Unban request ID'), status(['approved', 'denied']), field('resolution_text', 'Resolution note', 'text', { required: false, max: 500 })] },
  { name: 'shield', label: 'Change Shield Mode', resource: 'shield', scopes: ['moderator:manage:shield_mode'], fields: [field('is_active', 'Shield Mode active', 'boolean')] },
  { name: 'commercial', label: 'Run commercial', resource: 'ads', scopes: ['channel:edit:commercial'], fields: [field('length', 'Seconds', 'select', { options: ['30', '60', '90', '120', '150', '180'] })], note: 'Requires an eligible live channel. Twitch controls cooldowns.' },
  { name: 'ad-snooze', label: 'Snooze upcoming ad', resource: 'ads', scopes: ['channel:manage:ads'], fields: [], note: 'Twitch controls snooze availability.' },
  { name: 'raid-start', label: 'Start raid', resource: 'activity', scopes: ['channel:manage:raids'], fields: [id('to_broadcaster_id', 'Destination channel ID')] },
  { name: 'raid-cancel', label: 'Cancel pending raid', resource: 'activity', scopes: ['channel:manage:raids'], fields: [] },
  { name: 'reward-create', label: 'Create Channel Points reward', resource: 'rewards', scopes: ['channel:manage:redemptions'], fields: rewardFields, note: appOwned },
  { name: 'reward-update', label: 'Update Channel Points reward', resource: 'rewards', scopes: ['channel:manage:redemptions'], fields: [id('id', 'Reward ID'), ...rewardFields.map(item => ({ ...item, required: false }))], note: appOwned },
  { name: 'reward-delete', label: 'Delete Channel Points reward', resource: 'rewards', scopes: ['channel:manage:redemptions'], fields: [id('id', 'Reward ID')], note: appOwned },
  { name: 'redemption-update', label: 'Resolve redemption', resource: 'redemptions', scopes: ['channel:manage:redemptions'], fields: [reward, id('id', 'Redemption ID'), status(['FULFILLED', 'CANCELED'])], note: appOwned },
  { name: 'poll-create', label: 'Start poll', resource: 'polls', scopes: ['channel:manage:polls'], fields: [field('title', 'Question', 'text', { max: 60 }), field('choices', 'Choices (one per line)', 'list', { min: 2, max: 5 }), field('duration', 'Duration in seconds', 'number', { min: 15, max: 1800 })], note: 'Requires Affiliate or Partner eligibility; one active poll per channel.' },
  { name: 'poll-end', label: 'End poll', resource: 'polls', scopes: ['channel:manage:polls'], fields: [id('id', 'Poll ID'), status(['TERMINATED', 'ARCHIVED'])] },
  { name: 'prediction-create', label: 'Start prediction', resource: 'predictions', scopes: ['channel:manage:predictions'], fields: [field('title', 'Question', 'text', { max: 45 }), field('outcomes', 'Outcomes (one per line)', 'list', { min: 2, max: 10 }), field('prediction_window', 'Prediction window seconds', 'number', { min: 30, max: 1800 })], note: 'Requires Affiliate or Partner eligibility; resolving distributes viewers’ Channel Points.' },
  { name: 'prediction-end', label: 'Lock or resolve prediction', resource: 'predictions', scopes: ['channel:manage:predictions'], fields: [id('id', 'Prediction ID'), status(['LOCKED', 'RESOLVED', 'CANCELED']), field('winning_outcome_id', 'Winning outcome ID', 'text', { required: false, max: 100 })] },
  { name: 'clip-create', label: 'Create live clip', resource: 'clips', scopes: ['clips:edit'], fields: [field('has_delay', 'Apply stream delay', 'boolean', { required: false })], note: 'Requires a live channel with clips enabled. Creation completes asynchronously.' },
  { name: 'marker-create', label: 'Mark stream moment', resource: 'markers', scopes: ['channel:manage:broadcast'], fields: [field('description', 'Moment description', 'text', { required: false, max: 140 })], note: 'Requires a live broadcast with VOD storage enabled.' },
  { name: 'schedule-create', label: 'Publish planned broadcast', resource: 'schedule', scopes: ['channel:manage:schedule'], fields: scheduleFields, note: 'Explicitly publishes to Twitch; local stream plans are unchanged. One-time broadcasts require Affiliate or Partner eligibility.' },
  { name: 'schedule-update', label: 'Update published broadcast', resource: 'schedule', scopes: ['channel:manage:schedule'], fields: [segmentId, ...scheduleFields.map(item => ({ ...item, required: false })), field('is_canceled', 'Cancel occurrence', 'boolean', { required: false })] },
  { name: 'schedule-delete', label: 'Delete published broadcast', resource: 'schedule', scopes: ['channel:manage:schedule'], fields: [segmentId] },
  { name: 'schedule-vacation', label: 'Update Twitch vacation', resource: 'schedule', scopes: ['channel:manage:schedule'], fields: [field('is_vacation_enabled', 'Vacation enabled', 'boolean'), field('vacation_start_time', 'Vacation start (ISO 8601)', 'text', { required: false }), field('vacation_end_time', 'Vacation end (ISO 8601)', 'text', { required: false }), field('timezone', 'IANA timezone', 'text', { required: false })] },
  { name: 'announcement', label: 'Send chat announcement', resource: 'activity', scopes: ['moderator:manage:announcements'], fields: [message, field('color', 'Announcement color', 'select', { required: false, options: ['primary', 'blue', 'green', 'orange', 'purple'] })] },
  { name: 'shoutout', label: 'Send channel shoutout', resource: 'activity', scopes: ['moderator:manage:shoutouts'], fields: [id('to_broadcaster_id', 'Channel to recognize')] },
  { name: 'moderator-add', label: 'Add moderator', resource: 'moderators', scopes: ['channel:manage:moderators'], fields: [user] },
  { name: 'moderator-remove', label: 'Remove moderator', resource: 'moderators', scopes: ['channel:manage:moderators'], fields: [user] },
  { name: 'vip-add', label: 'Add VIP', resource: 'vips', scopes: ['channel:manage:vips'], fields: [user] },
  { name: 'vip-remove', label: 'Remove VIP', resource: 'vips', scopes: ['channel:manage:vips'], fields: [user] },
];

export const TWITCH_RESOURCES: readonly TwitchResourceDescriptor[] = [
  { name: 'activity', label: 'Live activity', scopes: [] },
  { name: 'chat-settings', label: 'Chat modes', scopes: [] },
  { name: 'automod-settings', label: 'AutoMod settings', scopes: ['moderator:read:automod_settings'] },
  { name: 'automod-queue', label: 'Held AutoMod messages', scopes: ['moderator:manage:automod'], note: 'Live events collected while connected; Twitch does not provide a historical queue snapshot.' },
  { name: 'blocked-terms', label: 'Blocked terms', scopes: ['moderator:read:blocked_terms'] },
  { name: 'unban-requests', label: 'Unban requests', scopes: ['moderator:read:unban_requests'] },
  { name: 'shield', label: 'Shield Mode', scopes: ['moderator:read:shield_mode'] },
  { name: 'ads', label: 'Ad schedule', scopes: ['channel:read:ads'] },
  { name: 'rewards', label: 'Channel Points rewards', scopes: ['channel:read:redemptions'], note: appOwned },
  { name: 'redemptions', label: 'Reward redemptions', scopes: ['channel:read:redemptions'], note: 'Select a reward ID. Only app-owned rewards support redemption retrieval and management.' },
  { name: 'polls', label: 'Polls', scopes: ['channel:read:polls'] },
  { name: 'predictions', label: 'Predictions', scopes: ['channel:read:predictions'] },
  { name: 'clips', label: 'Clips', scopes: [] },
  { name: 'markers', label: 'Stream markers', scopes: ['channel:manage:broadcast'] },
  { name: 'followers', label: 'Channel followers', scopes: ['moderator:read:followers'] },
  { name: 'subscribers', label: 'Subscribers', scopes: ['channel:read:subscriptions'] },
  { name: 'bits', label: 'Bits leaderboard', scopes: ['bits:read'] },
  { name: 'moderators', label: 'Moderators', scopes: ['moderation:read'] },
  { name: 'vips', label: 'VIPs', scopes: ['channel:read:vips'] },
  { name: 'goals', label: 'Creator goals', scopes: ['channel:read:goals'], note: 'Read goal progress. Goal authoring remains on Twitch.' },
  { name: 'schedule', label: 'Published Twitch schedule', scopes: [] },
  { name: 'videos', label: 'Past broadcasts', scopes: [] },
  { name: 'hype-train', label: 'Hype Train', scopes: ['channel:read:hype_train'] },
  { name: 'charity', label: 'Charity campaign', scopes: ['channel:read:charity'] },
];
