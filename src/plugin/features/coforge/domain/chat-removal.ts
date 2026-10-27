export interface ChatRemoval {
  channelId: string;
  type: "message" | "user" | "all";
  messageId?: string;
  userId?: string;
  at?: string;
}
export interface ChatRemovalHistory {
  channelId: string;
  messages: string[];
  clearAt?: string;
  users: Array<{ id: string; at: string }>;
}
