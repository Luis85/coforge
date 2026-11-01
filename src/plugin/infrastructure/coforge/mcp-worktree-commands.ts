import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as deadline, clearTimeout } from 'node:timers';
import { setTimeout as pause } from 'node:timers/promises';
import type { StageInput } from '../../features/coforge/application/ports';
import type { WorkflowWorkspaceLease } from '../../features/coforge/application/workflow-workspace-ports';
import type { McpCodingCommands, McpCommandOutcome, McpCommandRequest } from '../../features/coforge/application/mcp-coding-ports';
import { ideaProjectId } from '../../features/coforge/domain/projects';
import { boolean, number, optional, shape, text } from '../../features/coforge/domain/check';
import { providerFailureFor, providerFailureInfo } from '../../features/coforge/domain/provider-failure';
import { McpToolError } from './mcp-errors';
import { McpCommandJournal, type StoredMcpCommand } from './mcp-command-journal';
import { McpCommandOutput, mcpCommandEnvironment } from './mcp-command-output';
import { sessionTextSanitizer } from './provider-session-safety';
import { boundedSessionSink } from './session-observation-sink';
import { startOwnedWorktreeProcess, inspectOwnedWorktreeLifetime, recoverOwnedWorktreeLifetime, OwnedWorktreeError, type OwnedWorktreeProcess, type OwnedWorktreeResult } from './native-process/owned-worktree-process';

interface ActiveCommand { controller: AbortController; taskId: string; projectId: string; process?: OwnedWorktreeProcess; work: Promise<void> }
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const requestCheck = shape({ command: text({ min: 1, max: 16000 }), idempotencyKey: text({ min: 1, max: 160 }), label: optional(text({ min: 1, max: 120 })),
  timeoutSeconds: optional(number({ integer: true, min: 1, max: 86400 })), yieldTimeMs: optional(number({ integer: true, min: 0, max: 5000 })) }, { strict: true });
const terminal = (status: McpCommandOutcome['status']) => !['starting', 'running'].includes(status);

/** Task-bound native commands. Persisted intent prevents duplicate execution after uncertain client replies. */
export class McpWorktreeCommands implements McpCodingCommands {
  private readonly journal: McpCommandJournal;
  private records: StoredMcpCommand[] = [];
  private readonly active = new Map<string, ActiveCommand>();
  private loading?: Promise<void>;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(directory: () => string, private readonly backend: typeof startOwnedWorktreeProcess = startOwnedWorktreeProcess,
    private readonly inspect = inspectOwnedWorktreeLifetime) { this.journal = new McpCommandJournal(directory); }
  describe() { return { platform: process.platform, shell: process.platform === 'win32' ? 'cmd.exe /d /s /c' : 'Unavailable on this host', managedCommandsSupported: process.platform === 'win32' }; }
  private ready(): Promise<void> {
    return this.loading ??= (async () => {
      this.records = await this.journal.load();
      for (const record of this.records) {
        if (terminal(record.outcome.status)) continue;
        const receipt = record.identity && record.lifetime ? await this.inspect(record.identity, record.lifetime) : undefined;
        record.outcome = { ...record.outcome, status: receipt ? receipt.reason === 'completed' ? receipt.rootExitCode === 0 ? 'completed' : 'failed' : 'interrupted' : 'unknown',
          ...(receipt ? { exitCode: receipt.rootExitCode, finishedAt: receipt.finishedAt } : {}), truncated: true };
      }
      await this.journal.save(this.records);
    })();
  }
  private mutate<T>(work: () => T | Promise<T>): Promise<T> {
    const next = this.pending.then(async () => {
      const before = this.records.map(record => ({ record, value: structuredClone(record) }));
      try {
        const value = await work();
        await this.journal.save(this.records).catch(error => {
          if (error instanceof McpToolError) throw error;
          throw new McpToolError('HOST_UNAVAILABLE', 'The private command ledger could not be saved. Restore plugin storage and inspect the original task before continuing.');
        });
        return value;
      }
      catch (error) {
        this.records = before.map(({ record, value }) => {
          record.outcome = value.outcome; record.identity = value.identity; record.lifetime = value.lifetime; return record;
        });
        throw error;
      }
    });
    this.pending = next.catch(() => undefined); return next;
  }
  private public(record: StoredMcpCommand): McpCommandOutcome { return structuredClone(record.outcome); }
  private find(projectId: string, taskId: string, commandId: string): StoredMcpCommand {
    const record = this.records.find(record => record.outcome.id === commandId && record.outcome.projectId === projectId && record.outcome.taskId === taskId);
    if (!record) throw new McpToolError('PERMISSION_DENIED', 'No command with that identity belongs to this project and task.');
    return record;
  }
  async start(input: StageInput, lease: WorkflowWorkspaceLease, raw: McpCommandRequest, validate: () => void): Promise<McpCommandOutcome> {
    await this.ready();
    if (!input.jobId || !input.workflow || input.workflow.worktreeCoding?.profile !== 'mcp-worktree-v1' || input.workflow.step.access !== 'editworktree'
      || !input.integration.allowImplementation || !lease.id || lease.readOnly) throw new McpToolError('PERMISSION_DENIED', 'This captured task does not authorize coding commands.');
    const request = requestCheck(raw); const taskId = input.jobId; const projectId = ideaProjectId(input.idea);
    const keyHash = digest(JSON.stringify([projectId, taskId, request.idempotencyKey]));
    const requestHash = digest(JSON.stringify([request.command, request.label ?? '', request.timeoutSeconds ?? null]));
    let launch = false;
    const record = await this.mutate(() => {
      const existing = this.records.find(record => record.keyHash === keyHash);
      if (existing) {
        if (existing.requestHash !== requestHash) throw new McpToolError('CONFLICT', 'This idempotency key already belongs to different command input. Inspect its result; use a new key only for an intentional new execution.', 'coforge_command_status');
        return existing;
      }
      if (this.active.size >= 8 || [...this.active.values()].filter(command => command.taskId === taskId).length >= 2)
        throw new McpToolError('TASK_NOT_READY', 'The native command capacity is occupied. Inspect or stop an existing command before starting another.', 'coforge_command_status', 1000);
      if (this.records.length >= 2000) throw new McpToolError('HOST_UNAVAILABLE', 'Retained command history reached its bounded capacity. Review it in CoForge before admitting more commands.');
      const safe = sessionTextSanitizer({}, [lease.cwd]);
      const fullDisplay = safe(request.command, 16000);
      const commandDisplay = fullDisplay.length <= 2000 ? fullDisplay : fullDisplay.slice(0, 1900) + '\n[Command display truncated; digest identifies full input]';
      const created: StoredMcpCommand = { keyHash, requestHash, outcome: { id: randomUUID(), projectId, taskId, runId: input.workflow!.runId, attemptId: input.workflow!.attemptId,
        label: safe(request.label ?? 'Worktree command', 120) || 'Worktree command', commandDisplay, commandDigest: digest(request.command),
        status: 'starting', startedAt: new Date().toISOString(), output: '', truncated: false, source: 'host-worktree-command' } };
      validate(); this.records.push(created); launch = true; return created;
    });
    if (launch) {
      const active: ActiveCommand = { controller: new AbortController(), taskId, projectId, work: Promise.resolve() };
      this.active.set(record.outcome.id, active);
      active.work = this.launch(record, active, input, lease, request, validate);
      void active.work.catch(() => undefined);
    }
    if (request.yieldTimeMs !== 0) await Promise.race([this.active.get(record.outcome.id)?.work ?? Promise.resolve(), pause(request.yieldTimeMs ?? 1000)]);
    return this.public(record);
  }
  private async launch(record: StoredMcpCommand, active: ActiveCommand, input: StageInput, lease: WorkflowWorkspaceLease, request: McpCommandRequest, validate: () => void): Promise<void> {
    const output = new McpCommandOutput([lease.cwd]);
    const sink = boundedSessionSink(input.onSessionEvent); let observedAt = 0;
    const display = (value: string) => {
      const safe = sessionTextSanitizer({}, [lease.cwd])(value, 8192);
      const marker = '\n[Observation truncated; read command output]';
      return safe.length <= 2048 ? safe : safe.slice(0, 2048 - marker.length).replace(/[\uD800-\uDBFF]$/u, '') + marker;
    };
    let timer: ReturnType<typeof deadline> | undefined;
    const abort = () => active.controller.abort(); input.signal?.addEventListener('abort', abort, { once: true });
    try {
      input.signal?.throwIfAborted(); await lease.validate?.(); validate();
      const executable = process.platform === 'win32' ? join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? 'C:\\Windows', 'System32', 'cmd.exe') : '/bin/bash';
      const args = process.platform === 'win32' ? ['/d', '/s', '/c', `"${request.command}"`] : ['--noprofile', '--norc', '-c', request.command];
      const observe = (bytes: Uint8Array, stream: 'stdout' | 'stderr') => {
        output.append(bytes, stream); record.outcome = { ...record.outcome, ...output.snapshot() };
        if (record.outcome.output && Date.now() - observedAt >= 500) {
          observedAt = Date.now();
          sink.emit({ kind: 'tool', tool: 'coforge_run_command', label: record.outcome.label, status: 'running',
            text: display(`Host-observed command output snapshot · ${record.outcome.id}\n${record.outcome.output.slice(-1800)}`) });
        }
      };
      active.process = await this.backend(executable, args, { cwd: lease.cwd, env: mcpCommandEnvironment(), signal: active.controller.signal,
        windowsVerbatimArguments: process.platform === 'win32',
        owner: { projectId: record.outcome.projectId, runId: record.outcome.runId, attemptId: record.outcome.attemptId },
        onStarted: async (identity, lifetime) => {
          validate(); await lease.validate?.();
          await this.mutate(() => { record.identity = identity; record.lifetime = lifetime; record.outcome.status = 'running'; });
          validate();
          sink.emit({ kind: 'tool', tool: 'coforge_run_command', label: record.outcome.label, status: 'running', text: display(`Host command admitted · ${record.outcome.id}\n${record.outcome.commandDisplay ?? 'Command display unavailable'}`) });
        }, onStdout: bytes => observe(bytes, 'stdout'), onStderr: bytes => observe(bytes, 'stderr') });
      if (active.controller.signal.aborted) await active.process.stop('cancelled');
      const seconds = request.timeoutSeconds ?? (input.workflow?.step.execution?.mode === 'background' ? input.workflow.step.execution.maxRuntimeSeconds : input.settings.timeoutSeconds);
      if (seconds !== undefined) timer = deadline(() => { void active.process?.stop('timeout'); }, seconds * 1000);
      const result = await active.process.result;
      output.finish();
      await this.finish(record, result, output.snapshot());
      sink.emit({ kind: 'tool', tool: 'coforge_run_command', label: record.outcome.label,
        status: record.outcome.status === 'completed' ? 'completed' : record.outcome.status === 'failed' ? 'failed' : 'unknown',
        text: display(`Host-observed command ${record.outcome.id}: ${record.outcome.status}${record.outcome.exitCode === undefined ? '' : ` · exit ${record.outcome.exitCode}`}\n${record.outcome.commandDisplay ?? ''}\n${record.outcome.output.slice(-1400)}`) });
    } catch (error) {
      output.finish();
      if (error instanceof OwnedWorktreeError) { record.identity ??= error.identity; record.lifetime ??= error.lifetime; }
      const receipt = record.identity && record.lifetime ? await this.inspect(record.identity, record.lifetime) : undefined;
      const unknown = !receipt && (!!record.identity || error instanceof OwnedWorktreeError && error.code === 'ownership_unknown');
      const classified = providerFailureInfo(error);
      const cancelled = !unknown && !classified && !(error instanceof McpToolError) && (input.signal?.aborted || active.controller.signal.aborted);
      const failure = unknown ? providerFailureFor('ownership_unknown') : classified ?? providerFailureFor(cancelled ? 'cancelled' : error instanceof McpToolError && error.code === 'HOST_UNAVAILABLE' ? 'persistence' : 'execution_failed');
      const detail = error instanceof OwnedWorktreeError || error instanceof McpToolError ? error.message : failure.summary;
      const observed = output.snapshot(); const combined = `${observed.output}\n${detail}\n${failure.nextStep}`.trim();
      await this.mutate(() => { record.outcome = { ...record.outcome, ...observed, status: unknown ? 'unknown' : cancelled ? 'interrupted' : 'failed', failure,
        finishedAt: new Date().toISOString(), output: combined.slice(-64000), truncated: observed.truncated || combined.length > 64000 }; }).catch(() => { record.outcome.status = 'unknown'; });
    } finally {
      if (timer) clearTimeout(timer); input.signal?.removeEventListener('abort', abort); await sink.finish(); this.active.delete(record.outcome.id);
    }
  }
  private async finish(record: StoredMcpCommand, result: OwnedWorktreeResult, output: { output: string; truncated: boolean }): Promise<void> {
    await this.mutate(() => { record.outcome = { ...record.outcome, ...output, status: !result.quiescent ? 'unknown' : result.reason !== 'completed' ? 'interrupted' : result.exitCode === 0 ? 'completed' : 'failed',
      ...(!result.quiescent ? { failure: providerFailureFor('ownership_unknown') } : result.failureCode ? { failure: providerFailureFor('installation') } : {}),
      ...(result.exitCode === null ? {} : { exitCode: result.exitCode }), finishedAt: result.finishedAt }; });
  }
  async status(projectId: string, taskId: string, commandId: string): Promise<McpCommandOutcome> { await this.ready(); return this.public(this.find(projectId, taskId, commandId)); }
  async list(projectId: string, taskId: string, raw: { offset?: number; limit?: number; onlyActive?: boolean }) {
    await this.ready();
    const { offset = 0, limit = 20, onlyActive = false } = shape({ offset: optional(number({ integer: true, min: 0, max: 100000 })),
      limit: optional(number({ integer: true, min: 1, max: 100 })), onlyActive: optional(boolean) }, { strict: true })(raw);
    const records = this.records.filter(record => record.outcome.projectId === projectId && record.outcome.taskId === taskId
      && (!onlyActive || !terminal(record.outcome.status) || record.outcome.status === 'unknown')).reverse();
    const commands = records.slice(offset, offset + limit).map(record => this.public(record));
    return { commands, total: records.length, ...(offset + commands.length < records.length ? { nextOffset: offset + commands.length } : {}) };
  }
  async cancel(projectId: string, taskId: string, commandId: string): Promise<McpCommandOutcome> {
    await this.ready(); const record = this.find(projectId, taskId, commandId); const active = this.active.get(commandId);
    if (active) { active.controller.abort(); await active.process?.stop('cancelled'); await active.work; }
    return this.public(record);
  }
  async settle(input: StageInput): Promise<{ quiescent: boolean; commands: McpCommandOutcome[] }> {
    await this.ready(); const projectId = ideaProjectId(input.idea); const taskId = input.jobId;
    const matching = [...this.active.entries()].filter(([, command]) => command.projectId === projectId && command.taskId === taskId);
    await Promise.all(matching.map(async ([id]) => { await this.cancel(projectId, taskId ?? '', id); }));
    const commands = this.records.filter(record => record.outcome.projectId === projectId && record.outcome.taskId === taskId).map(record => this.public(record));
    return { quiescent: commands.every(command => terminal(command.status) && command.status !== 'unknown'), commands };
  }
  async recover(projectId: string, taskId: string): Promise<{ quiescent: boolean; commands: McpCommandOutcome[] }> {
    await this.ready();
    const records = this.records.filter(record => record.outcome.projectId === projectId && record.outcome.taskId === taskId);
    for (const record of records) {
      if (terminal(record.outcome.status) && record.outcome.status !== 'unknown') continue;
      const receipt = record.identity && record.lifetime ? await recoverOwnedWorktreeLifetime(record.identity, record.lifetime) : undefined;
      if (receipt) await this.mutate(() => { record.outcome = { ...record.outcome, status: 'interrupted', exitCode: receipt.rootExitCode, finishedAt: receipt.finishedAt }; });
    }
    const commands = records.map(record => this.public(record));
    return { quiescent: commands.every(command => terminal(command.status) && command.status !== 'unknown'), commands };
  }
}
