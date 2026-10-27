import { number, shape, text } from "./check";
export interface StreamMessage {
  id: string;
  text: string;
  intervalMinutes: number;
  active: boolean;
  channelId: string;
  createdAt: string;
  updatedAt: string;
  streamKey?: string;
  nextDueAt?: string;
  lastQueuedAt?: string;
  lastSentAt?: string;
  lastError?: string;
}
export const streamMessageInput = shape(
  { text: text({ trim: true, min: 1, max: 500 }), intervalMinutes: number({ integer: true, min: 1, max: 240 }) },
  { strict: true },
);
