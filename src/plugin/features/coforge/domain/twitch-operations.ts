/** Channel operations are private, capability-bound data; adapters never expose tokens. */
export const TWITCH_RESOURCE_NAMES = ['activity', 'chat-settings', 'automod-settings', 'automod-queue', 'blocked-terms', 'unban-requests', 'shield', 'ads', 'rewards', 'redemptions', 'polls', 'predictions', 'clips', 'markers', 'followers', 'subscribers', 'bits', 'moderators', 'vips', 'goals', 'schedule', 'videos', 'hype-train', 'charity'] as const;
export type TwitchResource = typeof TWITCH_RESOURCE_NAMES[number];
export const TWITCH_ACTION_NAMES = ['chat-settings', 'automod-settings', 'automod-resolve', 'blocked-term-add', 'blocked-term-remove', 'warn', 'unban-request-resolve', 'shield', 'commercial', 'ad-snooze', 'raid-start', 'raid-cancel', 'reward-create', 'reward-update', 'reward-delete', 'redemption-update', 'poll-create', 'poll-end', 'prediction-create', 'prediction-end', 'clip-create', 'marker-create', 'schedule-create', 'schedule-update', 'schedule-delete', 'schedule-vacation', 'announcement', 'shoutout', 'moderator-add', 'moderator-remove', 'vip-add', 'vip-remove'] as const;
export type TwitchActionName = typeof TWITCH_ACTION_NAMES[number];
export type TwitchValue = string | number | boolean | string[];
export type TwitchParameters = Record<string, TwitchValue>;
export interface TwitchAction { name: TwitchActionName; parameters: TwitchParameters }
export interface TwitchReadResult { records: Record<string, unknown>[]; total?: number; cursor?: string }
export interface TwitchRaidTarget {
  id: string; login: string; name: string; title: string; categoryId: string; categoryName: string;
  isLive: boolean; viewers: number | null; startedAt?: string; checkedAt: string;
}
export interface TwitchOperationsPort {
  read(resource: TwitchResource, parameters?: TwitchParameters): Promise<TwitchReadResult>;
  execute(action: TwitchAction): Promise<TwitchReadResult | void>;
}
export interface TwitchOperationContext { channelId: string; accountId: string; clientId: string; scopes: readonly string[] }
export interface TwitchActionPreview { id: string; channelId: string; accountId: string; clientId: string; action: TwitchAction; createdAt: string }
export interface TwitchOperationIntent extends TwitchActionPreview {
  status: 'sending' | 'confirmed' | 'failed' | 'uncertain'; finishedAt?: string; error?: string;
  reviewedAt?: string; reviewNote?: string;
  receipt?: TwitchParameters; completion?: 'accepted' | 'completed';
}
export interface TwitchActivity {
  id: string; channelId: string; type: string; at: string; summary: string;
  actorId?: string; actorName?: string; amount?: number; acknowledgedAt?: string; streamId?: string;
  details?: TwitchParameters; linkedIdeaId?: string; linkedProjectId?: string;
}
export interface TwitchOperationTemplate { id: string; name: string; action: TwitchAction; updatedAt: string }
export interface TwitchCollectionGap { channelId: string; startedAt: string; endedAt?: string; reason: string }
export interface TwitchOperationsState { activities: TwitchActivity[]; intents: TwitchOperationIntent[]; gaps: TwitchCollectionGap[]; retentionDays: number; templates?: TwitchOperationTemplate[] }
export interface TwitchResourceSnapshot { status: 'ready' | 'loading' | 'unavailable'; checkedAt?: string; result?: TwitchReadResult; error?: string; parameters?: TwitchParameters }
export interface TwitchCapabilityStatus { resource: TwitchResource; label: string; available: boolean; missingScopes: string[]; note?: string }
export interface TwitchOperationsSnapshot extends TwitchOperationsState {
  resources: Partial<Record<TwitchResource, TwitchResourceSnapshot>>; capabilities: TwitchCapabilityStatus[];
}
export interface TwitchOperationField {
  name: string; label: string; type: 'text' | 'number' | 'boolean' | 'list' | 'select';
  required?: boolean; min?: number; max?: number; options?: readonly string[]; hint?: string;
}
export interface TwitchActionDescriptor { name: TwitchActionName; label: string; resource: TwitchResource; scopes: readonly string[]; fields: readonly TwitchOperationField[]; note?: string }
export interface TwitchResourceDescriptor { name: TwitchResource; label: string; scopes: readonly string[]; note?: string }
export const emptyTwitchOperations = (): TwitchOperationsState => ({ activities: [], intents: [], gaps: [], retentionDays: 30 });
export interface TwitchOperationsActions {
  snapshot(): TwitchOperationsSnapshot;
  preview(action: TwitchAction): TwitchActionPreview;
  execute(preview: TwitchActionPreview): Promise<string>;
  refresh(resource: TwitchResource, parameters?: TwitchParameters): Promise<void>;
  acknowledgeActivity(id: string): Promise<void>;
  reconcile(id: string, note: string): Promise<void>;
  setRetention(days: number): Promise<void>;
  subscribe(listener: () => void): () => void;
  authorize?(feature: string): Promise<void>;
  previewRaid?(id: string): Promise<TwitchRaidTarget>;
  report?(streamId?: string): string;
  saveTemplate?(name: string, action: TwitchAction, id?: string): Promise<string>;
  removeTemplate?(id: string): Promise<void>;
  linkActivity?(id: string, ideaId: string): Promise<void>;
}
