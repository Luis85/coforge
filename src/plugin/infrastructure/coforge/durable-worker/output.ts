import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';
import { WorkerFiles } from './files';
import { codexReconnectNotice, CodexEventScope } from '../../../features/coforge/application/codex-events';
import { record } from '../../../features/coforge/domain/check';

/** Two bounded segments retain byte observations and final redacted semantics; verbosity never kills the task. */
export class OutputSpool {
  private slot = 0; private size = 0;
  constructor(private readonly files: WorkerFiles, private readonly stream: 'stdout' | 'stderr', private readonly segmentBytes = 2 * 1024 * 1024) {}
  async append(chunk: Buffer): Promise<void> {
    await this.files.verifyIdentity();
    let offset = 0;
    while (offset < chunk.length) {
      if (this.size >= this.segmentBytes) { this.slot = 1 - this.slot; this.size = 0; }
      const path = this.files.path(this.stream + '-' + this.slot + '.log');
      const before = await lstat(path).catch(error => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined; throw error; });
      if (before && (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)) throw new Error('Private worker output identity changed.');
      const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | (this.size === 0 ? constants.O_TRUNC : constants.O_APPEND), 0o600);
      const length = Math.min(chunk.length - offset, this.segmentBytes - this.size);
      try { await handle.write(chunk.subarray(offset, offset + length)); } finally { await handle.close(); }
      this.size += length; offset += length;
    }
  }
}
/** Retains bounded final semantics in memory; raw reasoning and tool transcripts are not retained. */
export class ProviderOutput {
  private readonly decoder = new StringDecoder('utf8');
  private pending = ''; private dropping = false; private message = ''; private terminal = ''; private tail = ''; private header = ''; private failure = ''; private completion = '';
  private readonly scope = new CodexEventScope();
  constructor(private readonly codex: boolean) {}
  append(chunk: Buffer): void {
    const text = this.decoder.write(chunk);
    if (!this.codex) { this.tail = (this.tail + text).slice(-8 * 1024 * 1024); return; }
    for (const character of text) {
      if (character === '\n') { if (!this.dropping) this.line(this.pending); this.pending = ''; this.dropping = false; }
      else if (!this.dropping) { this.pending += character; if (this.pending.length > 1024 * 1024) { this.pending = ''; this.dropping = true; } }
    }
  }
  private line(line: string) {
    let event: unknown; try { event = JSON.parse(line); } catch { return; }
    if (!event || typeof event !== 'object' || Array.isArray(event) || !this.scope.accepts(record(event)) || !('type' in event)) return;
    if (event.type === 'thread.started') this.header = line;
    if (event.type === 'item.completed' && 'item' in event && event.item && typeof event.item === 'object' && 'type' in event.item && event.item.type === 'agent_message') this.message = line;
    if (['turn.completed', 'turn.failed', 'error'].includes(String(event.type))) this.terminal = line;
    if (event.type === 'turn.failed' || event.type === 'error' && (this.completion || !codexReconnectNotice(record(event)))) this.failure = line;
    if (event.type === 'turn.completed' && !this.completion) this.completion = line;
  }
  result(): string { if (!this.codex) return this.tail; if (!this.dropping && this.pending) this.line(this.pending); return [this.header, this.message, this.completion, this.failure, this.terminal].filter((line, index, lines) => !!line && lines.indexOf(line) === index).join('\n'); }
}
