export type TwitchRole = 'streamer' | 'bot';
export interface TwitchIdentity { id: string; login: string; scopes: string[] }
export interface TwitchChannel { id: string; login: string; name: string; title: string; categoryId: string; categoryName: string; tags?: string[]; language?: string }
export interface TwitchChannelUpdate { title: string; categoryId: string; tags?: string[]; language?: string }
export interface TwitchAuthorization { role: TwitchRole; userCode: string; verificationUri: string; expiresAt: string }
export interface TwitchState {
  phase: 'disabled' | 'setup' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  message: string; channel?: TwitchChannel; streamer?: TwitchIdentity; bot?: TwitchIdentity;
  authorization?: TwitchAuthorization; lastError?: string;
  canChat: boolean; canManage: boolean; canModerate: boolean;
  tracking?: { phase: 'idle' | 'live' | 'offline' | 'error'; message: string; checkedAt?: string; streamId?: string; presentPlayers?: number };
}
export interface BotReply {
  id: string; parentMessageId?: string; channelId: string; senderId: string; text: string; createdAt: string; streamMessageId?: string; streamKey?: string;
  reviewedAt?: string; greetingPlayerId?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'uncertain' | 'cancelled'; messageId?: string; error?: string;
}
export type ModerationAction = { type: 'delete'; messageId: string } | { type: 'timeout' | 'ban'; userId: string; duration?: number; reason: string } | { type: 'unban'; userId: string };
export interface TwitchActions {
  authorize(role: TwitchRole): Promise<void>; cancelAuthorization(): void; reconnect(): Promise<void>;
  refreshChannel(): Promise<void>; updateChannel(input: TwitchChannelUpdate): Promise<void>;
  searchCategories(query: string): Promise<Array<{ id: string; name: string }>>;
  resolveUser(login: string): Promise<{ id: string; login: string }>;
  send(text: string): Promise<void>; moderate(action: ModerationAction): Promise<void>; retryReply(id: string): Promise<void>;
  refreshPlayer?(userId: string): Promise<void>; refreshPopulation?(): Promise<void>;
}
export const disconnectedTwitch = (): TwitchState => ({ phase: 'disabled', message: 'Twitch is not connected', canChat: false, canManage: false, canModerate: false });
