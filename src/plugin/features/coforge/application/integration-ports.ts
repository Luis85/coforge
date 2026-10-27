import type { ModerationAction } from "../domain/twitch";
export interface ChannelRestriction {
  userId: string;
  expiresAt?: string;
}
export interface ModerationReceipt { expiresAt?: string }
export interface ChatSenderPort {
  send(text: string, parentMessageId?: string, expectedSender?: string, expectedChannel?: string): Promise<string>;
}
export interface PlayerModerationPort {
  moderate(action: ModerationAction): Promise<ModerationReceipt | void>;
  restrictions(userIds: readonly string[]): Promise<ChannelRestriction[]>;
}
export interface LivePresencePort {
  liveStream(): Promise<{ id: string; startedAt: string } | null>;
  chatters(): Promise<string[]>;
  restrictions(userIds: readonly string[]): Promise<ChannelRestriction[]>;
}
