import { conversationText, type AgentConversationEvent } from '../domain/agent-conversation';
import type { StudioStore } from './studio-store';

/** Await before transport/validation: evidence persistence failures cannot silently dispatch work. */
export async function recordAgentConversation(store: StudioStore, jobId: string, event: AgentConversationEvent): Promise<void> {
  await store.transaction(state => {
    const job = state.jobs.find(item => item.id === jobId);
    if (!job) throw new Error('The task disappeared before its conversation evidence was saved.');
    const capturedAt = new Date().toISOString();
    if (event.kind === 'request') {
      if (job.conversation) throw new Error('This attempt’s request evidence is already captured.');
      job.conversation = { capturedAt, instructions: conversationText(event.instructions), prompt: conversationText(event.prompt), simulated: event.simulated === true };
    } else {
      if (!job.conversation) throw new Error('The response has no captured request.');
      if (job.conversation.response && !event.append) throw new Error('This attempt’s response evidence is already captured.');
      const previous = job.conversation.response;
      const captured = conversationText(previous ? `${previous.text}\n\n--- Additional submitted response ---\n\n${event.text}` : event.text);
      job.conversation.response = { ...captured, truncated: captured.truncated || previous?.truncated === true };
      job.conversation.responseCapturedAt = capturedAt;
    }
  });
}
