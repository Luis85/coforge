import { boolean, CheckError, list, number, oneOf, optional, shape, text, timestamp, type Check } from './check';

export const AGENT_SESSION_EVENT_LIMIT = 128;
export const AGENT_SESSION_TEXT_LIMIT = 32000;
export interface AgentSessionEvent {
  kind: 'session' | 'message' | 'tool' | 'notice';
  sessionId?: string; parentSessionId?: string; label?: string; tool?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'unknown';
  text?: string;
}
export interface AgentSessionEntry extends AgentSessionEvent { sequence: number; observedAt: string }
export interface AgentSessionTrace { events: AgentSessionEntry[]; truncated: boolean; lastObservedAt: string; nextSequence: number }
const identifier = text({ min: 1, max: 160 });
const eventFields = { kind: oneOf(['session', 'message', 'tool', 'notice'] as const), sessionId: optional(identifier), parentSessionId: optional(identifier), label: optional(identifier), tool: optional(identifier),
  status: optional(oneOf(['queued', 'running', 'completed', 'failed', 'unknown'] as const)), text: optional(text({ max: 2048 })) };
export const agentSessionEventCheck: Check<AgentSessionEvent> = shape(eventFields, { strict: true });
const entryCheck = shape({ ...eventFields, sequence: number({ integer: true, min: 1, max: Number.MAX_SAFE_INTEGER - 1 }), observedAt: timestamp }, { strict: true });
const traceCheck = shape({ events: list(entryCheck, { min: 1, max: AGENT_SESSION_EVENT_LIMIT }), truncated: boolean, lastObservedAt: timestamp,
  nextSequence: number({ integer: true, min: 2, max: Number.MAX_SAFE_INTEGER }) }, { strict: true });
const textSize = (event: AgentSessionEvent) => [event.text, event.sessionId, event.parentSessionId, event.label, event.tool].reduce<number>((sum, value) => sum + (value?.length ?? 0), 0);
/** These observations are private display evidence; they never authorize work or establish job completion. */
export const agentSessionTraceCheck: Check<AgentSessionTrace> = (input, path) => {
  const trace = traceCheck(input, path);
  let previous = 0;
  for (const event of trace.events) {
    if (event.sequence <= previous || event.sequence >= trace.nextSequence) throw new CheckError(path ?? '', 'session observation order changed');
    previous = event.sequence;
  }
  if (trace.events.reduce((sum, event) => sum + textSize(event), 0) > AGENT_SESSION_TEXT_LIMIT || trace.events.at(-1)?.observedAt !== trace.lastObservedAt)
    throw new CheckError(path ?? '', 'session observation bounds changed');
  return trace;
};

export function appendAgentSessionEvent(previous: AgentSessionTrace | undefined, input: AgentSessionEvent, at: string): AgentSessionTrace {
  const event = agentSessionEventCheck(input);
  const sequence = previous?.nextSequence ?? 1;
  if (sequence >= Number.MAX_SAFE_INTEGER) throw new CheckError('', 'session observation sequence is exhausted');
  const events = [...(previous?.events ?? []), { ...event, sequence, observedAt: timestamp(at) }];
  let size = events.reduce((sum, item) => sum + textSize(item), 0);
  let truncated = previous?.truncated === true;
  while (events.length > AGENT_SESSION_EVENT_LIMIT || size > AGENT_SESSION_TEXT_LIMIT) {
    const removed = events.shift();
    if (removed) size -= textSize(removed);
    truncated = true;
  }
  return { events, truncated, lastObservedAt: at, nextSequence: sequence + 1 };
}
