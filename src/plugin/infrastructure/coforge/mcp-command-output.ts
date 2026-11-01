import { StringDecoder } from 'node:string_decoder';
import { sessionTextSanitizer } from './provider-session-safety';

/** Streaming public output uses complete lines, redacts before clipping, and keeps the recent bounded tail. */
export class McpCommandOutput {
  private readonly streams = { stdout: { decoder: new StringDecoder('utf8'), pending: '', held: '', skipping: false }, stderr: { decoder: new StringDecoder('utf8'), pending: '', held: '', skipping: false } };
  private output = '';
  private truncated = false;
  private readonly sanitize: ReturnType<typeof sessionTextSanitizer>;
  constructor(paths: readonly string[], env: NodeJS.ProcessEnv = process.env) { this.sanitize = sessionTextSanitizer(env, paths); }
  append(bytes: Uint8Array, stream: 'stdout' | 'stderr'): void { this.text(this.streams[stream].decoder.write(Buffer.from(bytes)), stream); }
  private text(value: string, stream: 'stdout' | 'stderr'): void {
    const state = this.streams[stream];
    for (const part of value.split(/(?<=\n)/u)) {
      if (state.skipping) { if (part.endsWith('\n')) state.skipping = false; continue; }
      if (state.pending.length + part.length > 65536) { state.pending = ''; state.skipping = !part.endsWith('\n'); this.truncated = true; continue; }
      state.pending += part;
      if (state.pending.endsWith('\n')) { this.publish(state.pending, stream); state.pending = ''; }
    }
  }
  private publish(text: string, stream: 'stdout' | 'stderr', final = false): void {
    const state = this.streams[stream]; const raw = state.held + text;
    const value = this.sanitize(raw, 65536);
    if (!final && /\bBearer\s*$/iu.test(value)) {
      if (raw.length > 65536) { state.held = ''; this.truncated = true; } else state.held = raw;
      return;
    }
    state.held = '';
    if (!value) return;
    this.output += (this.output ? '\n' : '') + value;
    if (this.output.length > 64000) { this.truncated = true; this.output = this.output.slice(-64000).replace(/^[\uDC00-\uDFFF]/u, ''); }
  }
  finish(): void {
    for (const stream of ['stdout', 'stderr'] as const) {
      this.text(this.streams[stream].decoder.end(), stream);
      if (this.streams[stream].pending || this.streams[stream].held) this.publish(this.streams[stream].pending, stream, true);
      this.streams[stream].pending = '';
    }
  }
  snapshot(): { output: string; truncated: boolean } { return { output: this.output, truncated: this.truncated }; }
}

export function mcpCommandEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keys = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS']);
  return Object.fromEntries(Object.entries(source).filter(([key, value]) => value !== undefined && keys.has(key.toUpperCase())));
}
