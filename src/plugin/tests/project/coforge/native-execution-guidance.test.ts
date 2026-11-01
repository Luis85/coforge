import { expect, it } from 'vitest';
import { executionGuidance } from '../../../features/coforge/application/execution-guidance';

it('truthfully permits provider-owned assistants without claiming operator child dispatch', () => {
  const value = executionGuidance('readproject', 'design', undefined, { delegation: { maxConcurrent: 2 } });
  expect(value).toContain('Provider-native subagents are enabled');
  expect(value).toContain('2 concurrent');
  expect(value).toContain('CoForge does not dispatch');
  expect(value).not.toContain('These capabilities are unavailable to native workflow invocations');
  expect(value).toContain('Command execution and test runners are unavailable');
});
it('describes observed sandbox command outcomes and staleness while preserving request replacement', () => {
  const value = executionGuidance('editworktree', 'codechange', undefined, { verification: { commandIds: ['check'] } });
  expect(value).toContain('coforge_run_tests');
  expect(value).toContain('commandId');
  expect(value).toContain('Source changes after a command');
  expect(value).toContain('exit zero');
  expect(executionGuidance('none', 'markdown', 'request-replacement', { delegation: { maxConcurrent: 1 } })).toContain('Return only the polished replacement request text');
});
