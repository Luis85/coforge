import { lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { McpCommandOutcome } from '../../features/coforge/application/mcp-coding-ports';
import { boolean, list, number, oneOf, optional, shape, text, timestamp } from '../../features/coforge/domain/check';
import { nativeWorkflowLifetimeRefCheck, type NativeWorkflowLifetimeRef } from '../../features/coforge/domain/native-workflow-lifetime';
import { nativeWorkflowProcessIdentityCheck, type NativeWorkflowProcessIdentity } from '../../features/coforge/domain/native-workflow-process';
import { providerFailureInfoCheck } from '../../features/coforge/domain/provider-failure';
import { McpToolError } from './mcp-errors';

export interface StoredMcpCommand { outcome: McpCommandOutcome; keyHash: string; requestHash: string; identity?: NativeWorkflowProcessIdentity; lifetime?: NativeWorkflowLifetimeRef }
const id = text({ min: 1, max: 160 }), hash = text({ pattern: /^[a-f0-9]{64}$/u });
const outcomeCheck = shape({ id, projectId: id, taskId: id, runId: id, attemptId: id, label: text({ min: 1, max: 120 }),
  status: oneOf(['starting', 'running', 'completed', 'failed', 'interrupted', 'unknown'] as const), startedAt: timestamp, finishedAt: optional(timestamp), exitCode: optional(number({ integer: true })),
  commandDisplay: optional(text({ max: 2000 })), commandDigest: optional(hash),
  failure: optional(providerFailureInfoCheck),
  output: text({ max: 64000 }), truncated: boolean, source: oneOf(['host-worktree-command'] as const) }, { strict: true });
const journalCheck = shape({ version: oneOf([1] as const), commands: list(shape({ outcome: outcomeCheck, keyHash: hash, requestHash: hash,
  identity: optional(nativeWorkflowProcessIdentityCheck), lifetime: optional(nativeWorkflowLifetimeRefCheck) }, { strict: true }), { max: 2000 }) }, { strict: true });
const MAX_BYTES = 130 * 1024 * 1024;
const capacityError = () => new McpToolError('HOST_UNAVAILABLE', 'The private command ledger reached its byte capacity. Preserve its existing command history before continuing.');

/** Private intent/ownership plus sanitized display. Raw command input, environment and provider credentials are never stored. */
export class McpCommandJournal {
  private directory = '';
  constructor(private readonly root: () => string, private readonly maxBytes = MAX_BYTES) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) throw new McpToolError('HOST_UNAVAILABLE', 'The private command ledger byte budget is invalid.');
  }
  async load(): Promise<StoredMcpCommand[]> {
    const root = this.root(); if (!root) throw new Error('MCP command history is not initialized.');
    this.directory = resolve(root, 'mcp-command-ledger');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.validate();
    try {
      const path = join(this.directory, 'commands.json'), stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('MCP command history identity changed.');
      if (stat.size > this.maxBytes) throw capacityError();
      const bytes = await readFile(path);
      if (bytes.length > this.maxBytes) throw capacityError();
      return journalCheck(JSON.parse(bytes.toString('utf8'))).commands;
    } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
  }
  private async validate(): Promise<void> {
    const stat = await lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(this.directory) !== this.directory) throw new Error('MCP command history is not a canonical private directory.');
  }
  async save(commands: readonly StoredMcpCommand[]): Promise<void> {
    await this.validate(); const value = journalCheck({ version: 1, commands });
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    if (bytes.length > this.maxBytes) throw capacityError();
    const path = join(this.directory, 'commands.json');
    const temporary = join(this.directory, 'commands-' + crypto.randomUUID() + '.tmp');
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await this.validate(); await rename(temporary, path);
  }
}
