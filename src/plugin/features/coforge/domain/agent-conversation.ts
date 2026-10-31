import { boolean, optional, shape, text, timestamp } from './check';

/** Private provider-bound evidence, independent of mutable request notes and operational logs. */
export const AGENT_CONVERSATION_TEXT_LIMIT = 64000;
export interface ConversationText { text: string; truncated: boolean }
export interface AgentConversation {
  capturedAt: string;
  instructions: ConversationText;
  prompt: ConversationText;
  response?: ConversationText;
  responseCapturedAt?: string;
  simulated: boolean;
}
const capturedText = shape({ text: text({ max: AGENT_CONVERSATION_TEXT_LIMIT }), truncated: boolean });
export const agentConversationCheck = shape({
  capturedAt: timestamp, instructions: capturedText, prompt: capturedText,
  response: optional(capturedText), responseCapturedAt: optional(timestamp), simulated: boolean,
});
export type AgentConversationEvent =
  | { kind: 'request'; instructions: string; prompt: string; simulated?: boolean }
  | { kind: 'response'; text: string; append?: boolean };
export function conversationText(value: string): ConversationText {
  return { text: value.slice(0, AGENT_CONVERSATION_TEXT_LIMIT), truncated: value.length > AGENT_CONVERSATION_TEXT_LIMIT };
}
