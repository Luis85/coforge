import { StringDecoder } from 'node:string_decoder';
import { codexReconnectNotice, CodexEventScope } from '../../features/coforge/application/codex-events';
import { record } from '../../features/coforge/domain/check';

/** Root terminal semantics survive verbose native command output; reasoning/tool payloads are never retained. */
export class CodexOutput {
  private readonly decoder = new StringDecoder('utf8'); private readonly scope = new CodexEventScope();
  private pending = ''; private dropping = false; private header = ''; private message = ''; private completion = ''; private failure = ''; private terminal = '';
  append(chunk: Uint8Array): void {
    for (const part of this.decoder.write(Buffer.from(chunk)).split(/(?<=\n)/u)) {
      if (this.dropping) { if (part.endsWith('\n')) this.dropping = false; continue; }
      if (this.pending.length + part.length > 1024 * 1024) { this.pending = ''; this.dropping = !part.endsWith('\n'); continue; }
      this.pending += part;
      if (this.pending.endsWith('\n')) { this.line(this.pending.trimEnd()); this.pending = ''; }
    }
  }
  private line(line: string): void {
    let event: unknown; try { event = JSON.parse(line); } catch { return; }
    if (!event || typeof event !== 'object' || Array.isArray(event) || !this.scope.accepts(record(event)) || !('type' in event)) return;
    if (event.type === 'thread.started') this.header = line;
    if (event.type === 'item.completed' && 'item' in event && record(event.item).type === 'agent_message') this.message = line;
    if (['turn.completed', 'turn.failed', 'error'].includes(String(event.type))) this.terminal = line;
    if (event.type === 'turn.failed' || event.type === 'error' && (this.completion || !codexReconnectNotice(record(event)))) this.failure = line;
    if (event.type === 'turn.completed' && !this.completion) this.completion = line;
  }
  result(): string {
    if (this.pending && !this.dropping) { this.line(this.pending); this.pending = ''; }
    return [this.header, this.message, this.completion, this.failure, this.terminal].filter((line, index, lines) => !!line && lines.indexOf(line) === index).join('\n');
  }
}
