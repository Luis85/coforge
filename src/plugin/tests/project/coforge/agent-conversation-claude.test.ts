import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('../../../infrastructure/coforge/process', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../infrastructure/coforge/process')>()), captureProcess: transport.run,
}));
import { runClaudeStage } from '../../../infrastructure/coforge/claude-runner';
import { ProcessFailure } from '../../../infrastructure/coforge/process';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import type { AgentConversationEvent } from '../../../features/coforge/domain/agent-conversation';
import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowWorkspaces } from '../../../features/coforge/application/workflow-workspace-ports';
import { ai, increment } from './configured-workflow-fixture';

const input = (): StageInput => ({ stage: 'screen', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration() });
beforeEach(() => { transport.run.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });

it('records provider-bound prompts before dispatch and rejected structured answers before validation', async () => {
  const seen: AgentConversationEvent[] = [];
  const task = input();
  transport.run.mockImplementation(async (_bin, args, options) => {
    expect(seen).toEqual([{ kind: 'request', instructions: args[args.indexOf('--system-prompt') + 1], prompt: options.input }]);
    return JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { verdict: 'invalid', reason: '<script>untrusted</script>' } });
  });
  await expect(runClaudeStage({ ...task, onConversation: async event => { seen.push(event); } })).rejects.toMatchObject({ failure: { code: 'output_validation' } });
  expect(seen[1]).toEqual({ kind: 'response', text: JSON.stringify({ verdict: 'invalid', reason: '<script>untrusted</script>' }, null, 2) });
});

it('never dispatches when persisting request evidence fails', async () => {
  await expect(runClaudeStage({ ...input(), onConversation: async () => { throw new Error('Disk full'); } })).rejects.toMatchObject({ failure: { code: 'persistence' } });
  expect(transport.run).not.toHaveBeenCalled();
});

it('retains provider response text on a failed process without fabricating missing output', async () => {
  const seen: AgentConversationEvent[] = [];
  transport.run.mockRejectedValueOnce(new ProcessFailure('Run cancelled.', JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, result: 'Partial final answer' })));
  await expect(runClaudeStage({ ...input(), onConversation: async event => { seen.push(event); } })).rejects.toMatchObject({ failure: { code: 'cancelled' } });
  expect(seen[1]).toEqual({ kind: 'response', text: 'Partial final answer' });
});
it('retains reported spending and tokens when saving response evidence fails', async () => {
  const seen: string[] = [];
  transport.run.mockResolvedValueOnce(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.25, usage: { input_tokens: 30 }, structured_output: { verdict: 'clear', reason: 'Safe', signals: [] } }));
  await expect(runClaudeStage({ ...input(), onUsage: async () => { seen.push('cost'); }, onTokenUsage: async () => { seen.push('tokens'); },
    onConversation: async event => { seen.push(event.kind); if (event.kind === 'response') throw new Error('Disk full'); },
  })).rejects.toMatchObject({ failure: { code: 'persistence' } });
  expect(seen).toEqual(['request', 'cost', 'tokens', 'response']);
});
it('retains malformed primitive output for inspection while rejecting the result', async () => {
  const seen: AgentConversationEvent[] = [];
  transport.run.mockResolvedValueOnce('["unexpected answer"]');
  await expect(runClaudeStage({ ...input(), onConversation: async event => { seen.push(event); } })).rejects.toThrow('unexpected result envelope');
  expect(seen[1]).toEqual({ kind: 'response', text: '["unexpected answer"]' });
});
it('still captures partial workspace changes and releases its lease if failed-process response storage fails', async () => {
  const capture = vi.fn(async () => increment);
  const release = vi.fn(async () => {});
  const workspaces: WorkflowWorkspaces = {
    start: async () => {}, acknowledge: async () => {}, assertReviewable: async () => {},
    acquire: async () => ({ id: 'captured-workspace', cwd: '/bounded', capture, release }),
  };
  const task = input();
  task.stage = 'implement';
  task.workflow = { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal',
    step: { ...ai('build', 'codechange', 'editworktree'), provider: 'claude' }, inputArtifacts: [] };
  const changes = vi.fn(async () => {});
  transport.run.mockRejectedValueOnce(new ProcessFailure('Run cancelled.', JSON.stringify({ type: 'result', result: 'Partial answer' })));
  await expect(runClaudeStage({ ...task, onChanges: changes,
    onConversation: async event => { if (event.kind === 'response') throw new Error('Disk full'); },
  }, workspaces)).rejects.toMatchObject({ failure: { code: 'persistence' } });
  expect(capture).toHaveBeenCalledTimes(1);
  expect(changes).toHaveBeenCalledWith(increment);
  expect(release).toHaveBeenCalledTimes(1);
});
it('redacts recognizable credentials in response evidence without changing semantic validation input', async () => {
  vi.stubEnv('COFORGE_TEST_SECRET', 'synthetic-known-credential');
  const reason = 'synthetic-known-credential Bearer bearer-credential sk-ant-synthetic-credential';
  const seen: AgentConversationEvent[] = [];
  transport.run.mockResolvedValueOnce(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: { verdict: 'clear', reason, signals: [] } }));
  const result = await runClaudeStage({ ...input(), onConversation: async event => { seen.push(event); } });
  expect(result.screening?.reason).toBe(reason);
  expect(seen[1]).toEqual({ kind: 'response', text: JSON.stringify({ verdict: 'clear', reason: '[redacted] Bearer [redacted] [redacted]', signals: [] }, null, 2) });
});
it('redacts malformed failed-process stdout before retaining it for inspection', async () => {
  vi.stubEnv('COFORGE_TEST_SECRET', 'synthetic-known-credential');
  const seen: AgentConversationEvent[] = [];
  transport.run.mockRejectedValueOnce(new ProcessFailure('Synthetic failure', 'not-json synthetic-known-credential Bearer bearer-credential sk-ant-synthetic-credential'));
  await expect(runClaudeStage({ ...input(), onConversation: async event => { seen.push(event); } })).rejects.toMatchObject({ failure: { code: 'execution_failed' } });
  expect(seen[1]).toEqual({ kind: 'response', text: 'not-json [redacted] Bearer [redacted] [redacted]' });
});
it('retains both returned prose and structured output when the provider supplies both', async () => {
  const seen: AgentConversationEvent[] = [];
  const structured = { verdict: 'clear', reason: 'Scoped feature', signals: [] };
  transport.run.mockResolvedValueOnce(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'The feature is within scope.', structured_output: structured }));
  const result = await runClaudeStage({ ...input(), onConversation: async event => { seen.push(event); } });
  expect(result.screening?.reason).toBe('Scoped feature');
  expect(seen[1]).toEqual({ kind: 'response', text: JSON.stringify({ result: 'The feature is within scope.', structured_output: structured }, null, 2) });
});
