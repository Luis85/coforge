import { expect, it } from 'vitest';
import { claudeFailureMessage } from '../../../features/coforge/application/claude-failure';

it.each([
  ['error_max_turns', 'turn limit'],
  ['error_max_budget_usd', 'USD budget'],
  ['error_max_structured_output_retries', 'structured result'],
  ['error_during_execution', 'execution failure'],
])('explains %s without exposing provider payloads', (subtype, expected) => {
  const message = claudeFailureMessage(JSON.stringify({ type: 'result', subtype, errors: ['private model content'] }));
  expect(message).toContain(expected);
  expect(message).not.toContain('private model content');
  expect(message).toContain('partial worktree changes');
});
it('does not trust arbitrary transport errors or successful output', () => {
  for (const raw of ['', '{', '{"type":"result","subtype":"private text"}', '{"type":"result","subtype":"toString"}', '{"type":"result","subtype":"success"}', '{"type":"assistant","subtype":"error_max_turns"}'])
    expect(claudeFailureMessage(raw)).toBeUndefined();
});
