import { boolean, number, optional, record, text } from '../domain/check';
import type { AgentStage, Settings } from '../domain/types';
import { STAGE_JSON_SCHEMAS, stageSystemPrompt } from './agent-prompts';

/** Claude Code 2.1.259 or later supports the restricted, structured-output flags CoForge requires. */
export function supportsRequiredVersion(version: string): boolean {
  const match = version.match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  return major > 2 || (major === 2 && (minor > 1 || (minor === 1 && patch >= 259)));
}

const DENY = [
  'mcp__*', 'Bash', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Agent',
  'Read(**/.env)', 'Read(**/.env.*)', 'Read(**/*.pem)', 'Read(**/*.key)', 'Read(**/.git)', 'Read(**/.git/**)',
  'Edit(**/.git)', 'Write(**/.git)', 'Edit(**/.git/**)', 'Write(**/.git/**)', 'Edit(**/.claude/**)', 'Write(**/.claude/**)',
  'Edit(**/package.json)', 'Write(**/package.json)', 'Edit(**/*lock*)', 'Write(**/*lock*)',
];

/** The argv vector for one stage. Classification stages get no tools; planning is read-only; building may edit files. */
export function buildClaudeArgs(stage: AgentStage, settings: Settings): string[] {
  const tools = stage === 'screen' || stage === 'score' ? '' : stage === 'plan' ? 'Read,Glob,Grep' : 'Read,Glob,Grep,Edit,Write';
  return [
    '--print', '--output-format', 'json', '--input-format', 'text', '--json-schema', JSON.stringify(STAGE_JSON_SCHEMAS[stage]),
    '--restricted', '--safe-mode', '--no-session-persistence', '--no-chrome', '--setting-sources', '',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', tools, '--disallowedTools', DENY.join(','),
    '--permission-mode', stage === 'implement' ? 'acceptEdits' : 'dontAsk', '--permission-prompts', 'none',
    ...(tools ? ['--allowedTools', tools] : []),
    '--max-turns', String(settings.maxTurns), '--max-budget-usd', String(settings.maxBudgetUsd), '--model', settings.model,
    '--system-prompt', stageSystemPrompt(stage),
  ];
}

/** Accepts only a successful result envelope with structured output; never falls back to free-form prose. */
export function parseClaudeEnvelope(raw: string): { output: unknown; costUsd?: number } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw.trim()); } catch { throw new Error('Claude returned invalid JSON. The idea was not advanced.'); }
  let envelope: Record<string, unknown>;
  try {
    envelope = record(parsed);
    if (envelope.type !== 'result') throw new Error('type');
    text()(envelope.subtype); boolean(envelope.is_error); optional(number({ min: 0 }))(envelope.total_cost_usd);
  } catch { throw new Error('Claude returned an unexpected result envelope. The idea was not advanced.'); }
  if (envelope.is_error || envelope.subtype !== 'success')
    throw new Error(`Claude did not complete successfully (${String(envelope.subtype)}). Check authentication, budget and turn limits.`);
  if (envelope.structured_output === undefined)
    throw new Error('Claude did not return structured_output. Update Claude Code or inspect the configured model; the idea was not advanced.');
  const cost = envelope.total_cost_usd;
  return { output: envelope.structured_output, ...(typeof cost === 'number' ? { costUsd: cost } : {}) };
}
