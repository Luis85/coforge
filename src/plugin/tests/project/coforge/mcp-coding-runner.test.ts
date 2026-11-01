import { expect, it, vi } from 'vitest';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import type { McpCodingCommands, McpCommandOutcome } from '../../../features/coforge/application/mcp-coding-ports';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { nodeTimers } from './memory-storage';

async function fixture(coding = true, abortDuringConversation = false) {
  const events: string[] = [];
  const controller = new AbortController();
  const input: StageInput = { jobId: 'task', stage: 'implement', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' }, settings: defaultSettings(), signal: controller.signal,
    ...(abortDuringConversation ? { onConversation: async () => { controller.abort(); } } : {}),
    integration: { ...defaultIntegration(), allowImplementation: true }, workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      ...(coding ? { worktreeCoding: { version: 1, profile: 'mcp-worktree-v1' } } : {}),
      step: { id: 'build', kind: 'ai', name: 'Build', instructions: 'Build the task', access: 'editworktree', output: 'codechange', provider: 'claude', model: 'sonnet', automatic: false } } };
  const outcome: McpCommandOutcome = { id: 'command', projectId: 'CFP-001', taskId: 'task', runId: 'run', attemptId: 'attempt', label: 'Checks', status: 'running',
    output: 'Observed output', truncated: false, source: 'host-worktree-command', startedAt: new Date().toISOString() };
  const commands: McpCodingCommands = { start: vi.fn(async (_input, _lease, _request, validate) => { validate(); return outcome; }),
    status: vi.fn(async () => outcome), list: vi.fn(async () => ({ commands: [outcome], total: 1 })), cancel: vi.fn(async (): Promise<McpCommandOutcome> => ({ ...outcome, status: 'interrupted' })),
    settle: vi.fn(async (): Promise<{ quiescent: boolean; commands: McpCommandOutcome[] }> => { events.push('settled'); return { quiescent: true, commands: [{ ...outcome, status: 'completed', exitCode: 0 }] }; }),
    recover: vi.fn(async () => ({ quiescent: true, commands: [] })) };
  const runner = new McpStepRunner({ start: async () => {}, assertReviewable: async () => {}, acknowledge: async () => {},
    acquire: async () => ({ id: 'workspace', cwd: '/owned/worktree', validate: async () => {}, capture: async summary => {
      expect(events.at(-1)).toBe('settled'); events.push('captured');
      return { summary, files: [], diff: '', tests: [], createdAt: new Date().toISOString(), simulated: false };
    }, release: async () => { events.push('released'); } }) }, nodeTimers(), commands);
  const completion = runner.run(input); void completion.catch(() => undefined);
  if (!abortDuringConversation) await expect.poll(() => runner.tasks('CFP-001').length).toBe(1);
  return { runner, commands, events, completion, controller, input };
}

it('advertises and executes coding tools only for a captured coding task, settling commands before final capture', async () => {
  const f = await fixture();
  try {
    expect(f.runner.context('CFP-001', 'task')).toMatchObject({ workspace: { id: 'workspace', directory: '/owned/worktree' }, tools: expect.arrayContaining(['coforge_run_command', 'coforge_inspect_changes']) });
    const validate = vi.fn();
    expect(await f.runner.runCommand('CFP-001', 'task', { command: 'npm test', idempotencyKey: 'checks-1', label: 'Checks' }, validate)).toMatchObject({ id: 'command', status: 'running' });
    expect(validate).toHaveBeenCalledTimes(2);
    await f.runner.complete('CFP-001', 'task', { summary: 'Changed the requested feature' });
    await f.completion;
    expect(f.events).toEqual(['settled', 'captured', 'released']);
  } finally { await f.runner.dispose(); }
});
it('observes cancellation that arrives while saving the request before its pending-task listener is registered', async () => {
  const f = await fixture(true, true);
  try {
    await expect.poll(() => f.controller.signal.aborted).toBe(true);
    await expect.poll(() => f.runner.tasks('CFP-001').length, { timeout: 300 }).toBe(0);
    await expect(f.completion).rejects.toMatchObject({ failure: { code: 'cancelled' } });
  } finally { await f.runner.dispose(); await f.completion.catch(() => undefined); }
});

it('never upgrades a legacy task or grants a command to another project', async () => {
  const f = await fixture(false);
  try {
    await expect(f.runner.runCommand('CFP-001', 'task', { command: 'npm test', idempotencyKey: 'checks-1' }, () => {})).rejects.toThrow();
    await expect(f.runner.runCommand('CFP-999', 'task', { command: 'npm test', idempotencyKey: 'checks-1' }, () => {})).rejects.toThrow();
    expect(f.commands.start).not.toHaveBeenCalled();
  } finally { await f.runner.dispose(); await f.completion.catch(() => undefined); }
});
it.each([false, true])('quarantines an unsettled command without capturing a moving workspace or losing its typed cause (inspection throws: %s)', async inspectionThrows => {
  const f = await fixture();
  if (inspectionThrows) vi.mocked(f.commands.settle).mockRejectedValue(new Error('Private command ledger read failed'));
  else vi.mocked(f.commands.settle).mockResolvedValue({ quiescent: false, commands: [] });
  try {
    await expect(f.runner.complete('CFP-001', 'task', { summary: 'Cannot safely complete' })).rejects.toMatchObject({ failure: { code: 'ownership_unknown' } });
    await expect(f.completion).rejects.toMatchObject({ failure: { code: 'ownership_unknown' } });
    expect(f.events).toEqual(['released']);
  } finally { await f.runner.dispose(); }
});
it('reports response evidence storage failure safely and retains the active correction flow', async () => {
  const f = await fixture();
  f.input.onConversation = async () => { throw new Error('PRIVATE_STORAGE_PATH_AND_TOKEN'); };
  try {
    await expect(f.runner.complete('CFP-001', 'task', { summary: 'Requested change' })).rejects.toMatchObject({ failure: { code: 'persistence' } });
    expect(f.runner.tasks('CFP-001')).toHaveLength(1);
    delete f.input.onConversation;
    await f.runner.complete('CFP-001', 'task', { summary: 'Requested change' }); await f.completion;
  } finally { await f.runner.dispose(); await f.completion.catch(() => undefined); }
});
