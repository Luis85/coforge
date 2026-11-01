import { expect, it } from 'vitest';
import { reportedClaudeUsage } from '../../../features/coforge/application/claude-protocol';

const rootUsage = { input_tokens: 4, output_tokens: 1369, cache_read_input_tokens: 4549, cache_creation_input_tokens: 5554 };
const model = { inputTokens: 8, outputTokens: 1819, cacheReadInputTokens: 6608, cacheCreationInputTokens: 8015 };
const envelope = (modelUsage?: unknown) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, usage: rootUsage, ...(modelUsage === undefined ? {} : { modelUsage }) });
it('uses whole-query per-model counters for native Claude subagents instead of the smaller root loop', () => {
  expect(reportedClaudeUsage(envelope({ haiku: model }), { delegated: true })).toEqual(model);
  expect(reportedClaudeUsage(envelope({ haiku: model, sonnet: { inputTokens: 3, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 7 } }), { delegated: true }))
    .toEqual({ inputTokens: 11, outputTokens: 1824, cacheReadInputTokens: 6608, cacheCreationInputTokens: 8022 });
  expect(reportedClaudeUsage(envelope({ haiku: model }))).toEqual({ inputTokens: 4, outputTokens: 1369, cacheReadInputTokens: 4549, cacheCreationInputTokens: 5554 });
});
it.each([undefined, {}, { haiku: { inputTokens: 8, outputTokens: 1819 } }, { haiku: { ...model, inputTokens: -1 } }, { haiku: model, invalid: { ...model, outputTokens: 1.5 } },
  { first: { ...model, outputTokens: Number.MAX_SAFE_INTEGER }, second: model }])('does not infer a tree total from absent, partial or invalid model accounting', modelUsage => {
  expect(reportedClaudeUsage(envelope(modelUsage), { delegated: true })).toBeUndefined();
});
