import { expect, it } from 'vitest';
import { appendAgentSessionEvent, agentSessionTraceCheck, AGENT_SESSION_EVENT_LIMIT, AGENT_SESSION_TEXT_LIMIT } from '../../../features/coforge/domain/agent-session';

const at = '2026-11-01T12:00:00.000Z';
it('retains bounded, ordered observations without changing earlier snapshots', () => {
  const first = appendAgentSessionEvent(undefined, { kind: 'session', sessionId: 'root', status: 'running' }, at);
  const second = appendAgentSessionEvent(first, { kind: 'message', sessionId: 'child', parentSessionId: 'root', text: 'Observed assistant text' }, at);
  expect(first.events).toHaveLength(1);
  expect(second.events.map(event => event.sequence)).toEqual([1, 2]);
  expect(second.events[1]).toMatchObject({ sessionId: 'child', parentSessionId: 'root', text: 'Observed assistant text', observedAt: at });
  expect(agentSessionTraceCheck(second)).toEqual(second);
});

it('keeps the latest observations with explicit loss while preserving monotonic sequence', () => {
  let trace = appendAgentSessionEvent(undefined, { kind: 'notice', text: 'oldest' }, at);
  for (let index = 0; index < AGENT_SESSION_EVENT_LIMIT + 2; index++) trace = appendAgentSessionEvent(trace, { kind: 'tool', tool: 'coforge_read_file' }, at);
  expect(trace.events).toHaveLength(AGENT_SESSION_EVENT_LIMIT);
  expect(trace.truncated).toBe(true);
  expect(trace.events[0]?.sequence).toBe(4);
  expect(trace.nextSequence).toBe(AGENT_SESSION_EVENT_LIMIT + 4);
  expect(trace.events.some(event => event.text === 'oldest')).toBe(false);
});

it('enforces total retained text and rejects untrusted extra payload or malformed chronology', () => {
  let trace = appendAgentSessionEvent(undefined, { kind: 'notice', text: 'x'.repeat(2048) }, at);
  for (let index = 0; index < 40; index++) trace = appendAgentSessionEvent(trace, { kind: 'message', text: 'x'.repeat(2048) }, at);
  expect(trace.events.reduce((sum, event) => sum + (event.text?.length ?? 0), 0)).toBeLessThanOrEqual(AGENT_SESSION_TEXT_LIMIT);
  expect(trace.truncated).toBe(true);
  expect(() => agentSessionTraceCheck({ ...trace, nextSequence: 1 })).toThrow();
  expect(() => agentSessionTraceCheck({ ...trace, events: [{ ...trace.events[0], raw: 'PRIVATE_TRANSPORT' }] })).toThrow();
  expect(() => appendAgentSessionEvent(trace, { kind: 'message', text: 'x'.repeat(2049) }, at)).toThrow();
});
