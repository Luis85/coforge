import { record } from '../domain/check';

const messages: Readonly<Record<string, string>> = {
  error_max_turns: 'Claude reached the configured turn limit before completing. Review any partial worktree changes, then adjust the turn limit before an explicit retry.',
  error_max_budget_usd: 'Claude reached the configured USD budget before completing. Review usage and any partial worktree changes, then adjust the budget before an explicit retry.',
  error_max_structured_output_retries: 'Claude could not produce the required structured result within its retry limit. Review any partial worktree changes and the result contract before an explicit retry.',
  error_during_execution: 'Claude reported an execution failure. Review the failed attempt and any partial worktree changes before an explicit retry.',
};
/** Only fixed messages from recognized result codes may escape the raw transport. */
export function claudeFailureMessage(raw: string): string | undefined {
  try {
    const result = record(JSON.parse(raw));
    if (result.type !== 'result' || typeof result.subtype !== 'string') return undefined;
    return Object.hasOwn(messages, result.subtype) ? messages[result.subtype] : undefined;
  } catch { return undefined; }
}
