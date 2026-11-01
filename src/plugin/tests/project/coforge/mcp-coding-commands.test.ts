import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { McpWorktreeCommands } from '../../../infrastructure/coforge/mcp-worktree-commands';
import { McpCommandJournal } from '../../../infrastructure/coforge/mcp-command-journal';
import type { OwnedWorktreeOptions, OwnedWorktreeProcess, OwnedWorktreeResult } from '../../../infrastructure/coforge/native-process/owned-worktree-process';

const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  await mkdir('.nq', { recursive: true }); const root = await mkdtemp(join(resolve('.nq'), 'mcp-commands-')); roots.push(root);
  const input: StageInput = { jobId: 'task', stage: 'implement', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' }, settings: defaultSettings(), integration: { ...defaultIntegration(), allowImplementation: true },
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'v1', proposalRevision: 'proposal', inputArtifacts: [], worktreeCoding: { version: 1, profile: 'mcp-worktree-v1' },
      step: { id: 'build', kind: 'ai', name: 'Build', instructions: 'Build', provider: 'claude', model: 'sonnet', access: 'editworktree', output: 'codechange', automatic: false } } };
  let finish: (result: OwnedWorktreeResult) => void = () => {};
  const done = new Promise<OwnedWorktreeResult>(resolve => { finish = resolve; });
  const ended = (reason: OwnedWorktreeResult['reason'], exitCode = 0): OwnedWorktreeResult => ({ exitCode, reason, quiescent: true, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
  const backend = vi.fn(async (_executable: string, _args: readonly string[], options: OwnedWorktreeOptions): Promise<OwnedWorktreeProcess> => {
    await options.onStarted({ pid: 321, platform: 'win32', birth: 'fixture', image: 'a'.repeat(64) }, { version: 1, kind: 'windows-job', directory: root, ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64), ...options.owner });
    const saved = await readFile(join(root, 'mcp-command-ledger/commands.json'), 'utf8'); expect(saved).toContain('fixture'); expect(saved).not.toContain('TOKEN_IN_COMMAND');
    options.onStdout?.(Buffer.from('Observed output\nBearer PRIVATE_OUTPUT_TOKEN\n'));
    return { identity: { pid: 321, platform: 'win32', birth: 'fixture', image: 'a'.repeat(64) }, lifetime: { version: 1, kind: 'windows-job', directory: root, ownerToken: 'b'.repeat(64), sourceHash: 'c'.repeat(64), ...options.owner },
      result: done, stop: async () => { const result = ended('cancelled'); finish(result); return result; }, snapshot: () => ({ state: 'running', startedAt: new Date().toISOString() }) };
  });
  const commands = new McpWorktreeCommands(() => root, backend);
  const lease = { id: 'workspace', cwd: root, validate: async () => {}, capture: async () => undefined, release: async () => {} };
  return { input, commands, backend, lease, finish: () => finish(ended('completed')), root };
}
it('records ownership before command effects and reuses an uncertain-response idempotency key without replay', async () => {
  const f = await fixture();
  const request = { command: 'echo Bearer TOKEN_IN_COMMAND', idempotencyKey: 'check-1', label: 'Checks', yieldTimeMs: 0 };
  try {
    const first = await f.commands.start(f.input, f.lease, request, () => {});
    const same = await f.commands.start(f.input, f.lease, request, () => {});
    expect(same.id).toBe(first.id);
    expect(first.commandDisplay).toContain('[redacted]'); expect(first.commandDisplay).not.toContain('TOKEN_IN_COMMAND');
    await expect.poll(() => f.backend.mock.calls.length).toBe(1);
    await expect.poll(async () => (await f.commands.status('CFP-001', 'task', first.id)).output).toContain('Observed output');
    expect((await f.commands.status('CFP-001', 'task', first.id)).output).not.toContain('PRIVATE_OUTPUT_TOKEN');
    await expect(f.commands.start(f.input, f.lease, { ...request, command: 'different command' }, () => {})).rejects.toThrow();
    f.finish();
    await expect.poll(async () => (await f.commands.status('CFP-001', 'task', first.id)).status).toBe('completed');
    expect(f.backend).toHaveBeenCalledOnce();
    await expect(f.commands.status('CFP-999', 'task', first.id)).rejects.toThrow();
  } finally { await f.commands.settle(f.input); }
});
it('discovers retained task command IDs with bounded newest-first pagination without replay or cross-project leakage', async () => {
  const f = await fixture(); const ids: string[] = [];
  try {
    for (let index = 0; index < 3; index++) {
      const command = await f.commands.start(f.input, f.lease, { command: `echo ${index}`, idempotencyKey: `discover-${index}`, yieldTimeMs: 0 }, () => {});
      ids.push(command.id); f.finish();
      await expect.poll(async () => (await f.commands.status('CFP-001', 'task', command.id)).status).toBe('completed');
    }
    const first = await f.commands.list('CFP-001', 'task', { limit: 2 });
    expect(first).toMatchObject({ total: 3, nextOffset: 2 }); expect(first.commands.map(command => command.id)).toEqual(ids.slice(1).reverse());
    expect((await f.commands.list('CFP-001', 'task', { offset: 2, limit: 2 })).commands.map(command => command.id)).toEqual([ids[0]]);
    expect(await f.commands.list('CFP-999', 'task', {})).toEqual({ commands: [], total: 0 });
    expect(await f.commands.list('CFP-001', 'task', { onlyActive: true })).toEqual({ commands: [], total: 0 });
    expect(f.backend).toHaveBeenCalledTimes(3);
  } finally { await f.commands.settle(f.input); }
});
it('records cancellation during intent storage as interrupted without launching a command', async () => {
  const f = await fixture(); const controller = new AbortController(); f.input.signal = controller.signal;
  await expect(f.commands.status('CFP-001', 'task', 'missing')).rejects.toThrow();
  const save = McpCommandJournal.prototype.save;
  vi.spyOn(McpCommandJournal.prototype, 'save').mockImplementationOnce(async function (this: McpCommandJournal, records) { await save.call(this, records); controller.abort(); });
  const outcome = await f.commands.start(f.input, f.lease, { command: 'echo never', idempotencyKey: 'cancel-before-launch', yieldTimeMs: 1000 }, () => {});
  expect(outcome).toMatchObject({ status: 'interrupted', failure: { code: 'cancelled' } });
  expect(f.backend).not.toHaveBeenCalled(); expect((await f.commands.settle(f.input)).quiescent).toBe(true);
});
it('redacts a known environment credential before retaining command display or emitting observations', async () => {
  const credential = 'opaque-unformatted-private-value-12345'; vi.stubEnv('OPENAI_API_KEY', credential);
  const f = await fixture();
  try {
    const outcome = await f.commands.start(f.input, f.lease, { command: `echo ${credential}`, idempotencyKey: 'redaction', yieldTimeMs: 0 }, () => {});
    expect(outcome.commandDisplay).not.toContain(credential);
    expect(await readFile(join(f.root, 'mcp-command-ledger/commands.json'), 'utf8')).not.toContain(credential);
  } finally { await f.commands.settle(f.input); }
});
it('settles an owned background command before the task can release its workspace', async () => {
  const f = await fixture();
  await f.commands.start(f.input, f.lease, { command: 'npm run dev', idempotencyKey: 'server', yieldTimeMs: 0 }, () => {});
  await expect.poll(() => f.backend.mock.calls.length).toBe(1);
  const settled = await f.commands.settle(f.input);
  expect(settled.quiescent).toBe(true); expect(settled.commands).toHaveLength(1);
  expect(settled.commands[0]?.status).toBe('interrupted');
});
it('does not admit effects or retain a phantom running command after intent storage fails', async () => {
  const f = await fixture();
  await expect(f.commands.status('CFP-001', 'task', 'missing')).rejects.toThrow();
  vi.spyOn(McpCommandJournal.prototype, 'save').mockRejectedValueOnce(new Error('private disk failure detail'));
  const request = { command: 'echo check', idempotencyKey: 'retry-after-storage', yieldTimeMs: 0 };
  await expect(f.commands.start(f.input, f.lease, request, () => {})).rejects.toThrow('private command ledger could not be saved');
  expect(f.backend).not.toHaveBeenCalled();
  try {
    const admitted = await f.commands.start(f.input, f.lease, request, () => {});
    await expect.poll(() => f.backend.mock.calls.length).toBe(1);
    f.finish();
    await expect.poll(async () => (await f.commands.status('CFP-001', 'task', admitted.id)).status).toBe('completed');
  } finally { await f.commands.settle(f.input); }
});
