import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { setInterval, clearInterval, setTimeout as deadlineTimer, clearTimeout } from 'node:timers';
import { setTimeout as pause } from 'node:timers/promises';
import type { AgentSessionTrace } from '../../features/coforge/domain/agent-session';
import { agentSessionTraceCheck } from '../../features/coforge/domain/agent-session';
import { WorkerFiles } from './durable-worker/files';
import { redact } from './process';
import { sessionFollowerSource } from './agent-session-terminal-script';
import { launchAgentSessionTerminal, SessionTerminalNotStarted, type AgentSessionTerminalHandle } from './agent-session-terminal-launch';
export { sessionTerminalEnvironment } from './agent-session-terminal-launch';

export interface AgentSessionFollowSnapshot { label: string; status: string; trace: AgentSessionTrace }
interface FollowOptions {
  read(jobId: string): AgentSessionFollowSnapshot | undefined;
  nodeExecutable(): string | undefined;
  launch?(directory: string, node?: string): Promise<AgentSessionTerminalHandle | void>;
  intervalMs?: number;
}
interface Follower { files: WorkerFiles; handle?: AgentSessionTerminalHandle; pending?: Promise<void>; closed: boolean; uncertain?: boolean }
const clean = (text: string) => Array.from(redact(text)).filter(character => {
  const code = character.charCodeAt(0);
  return code === 9 || code === 10 || code === 13 || code >= 32 && (code < 127 || code > 159);
}).join('')
  .replace(/(?:[a-zA-Z]:[\\/]|\\\\)[^\r\n\t"'<>]*/gu, '[private path]')
  .replace(/(^|[\s("'`=])\/(?!\/)[^\s"'`<>]+/gu, '$1[private path]');
function render(snapshot: AgentSessionFollowSnapshot): string {
  const trace = agentSessionTraceCheck(snapshot.trace);
  const header = ['CoForge — READ-ONLY session observations', clean(snapshot.label).slice(0, 160), `Recorded attempt status: ${clean(snapshot.status).slice(0, 40)}`,
    `Last observed: ${trace.lastObservedAt}`, 'No input, attach, resume or agent control. Close this window to stop following.',
    ...(trace.truncated ? ['Earlier observations were omitted from this bounded display.'] : [])];
  return [...header, '', ...trace.events.map(event => [event.observedAt, event.sessionId, event.parentSessionId ? `(child of ${event.parentSessionId})` : '', event.label, event.tool, event.status, event.text]
    .filter(Boolean).map(value => clean(String(value))).join(' · '))].join('\n').slice(0, 100000);
}

/** A host-owned feed contains display text only; its observer has no connection to the provider. */
export class AgentSessionTerminal {
  private readonly followers = new Map<string, Follower>();
  private readonly openings = new Map<string, Promise<void>>();
  private timer?: ReturnType<typeof setInterval>;
  private disposed = false;
  constructor(private readonly options: FollowOptions) {}
  open(jobId: string): Promise<void> {
    const pending = this.openings.get(jobId); if (pending) return pending;
    const work = this.openFollower(jobId).finally(() => { this.openings.delete(jobId); });
    this.openings.set(jobId, work); return work;
  }
  private async openFollower(jobId: string): Promise<void> {
    if (this.disposed || !this.options.read(jobId)) throw new Error('This native session is unavailable in the active project.');
    const existing = this.followers.get(jobId);
    if (existing) {
      if (existing.uncertain) throw new Error('The original read-only terminal could not be confirmed. Use Peek; the agent is unaffected.');
      if (existing.pending) await this.bounded(existing.pending, 250);
      if (existing.pending || !existing.handle || await this.isOpen(existing)) return;
      if (!await this.retire(jobId, existing)) return;
    }
    const preparing = this.openings.size - (this.openings.has(jobId) ? 1 : 0);
    if (this.followers.size + preparing >= 4) throw new Error('Close another read-only session follower before opening more.');
    const files = new WorkerFiles(await mkdtemp(join(tmpdir(), 'coforge-session-follow-'))); await files.attach();
    const follower: Follower = { files, closed: false };
    let launchAttempted = false;
    try {
      await files.createSource('follow.cjs', sessionFollowerSource);
      await this.update(jobId, follower);
      launchAttempted = true;
      follower.handle = await (this.options.launch ?? launchAgentSessionTerminal)(files.directory, this.options.nodeExecutable()) ?? undefined;
      this.track(jobId, follower);
    } catch (error) {
      if (!launchAttempted || error instanceof SessionTerminalNotStarted) await this.remove(files).catch(() => undefined);
      else { follower.uncertain = true; follower.handle = { isOpen: async () => true }; this.track(jobId, follower); }
      throw error;
    }
  }
  private track(jobId: string, follower: Follower): void {
    this.followers.set(jobId, follower);
    if (!this.disposed) this.timer ??= setInterval(() => { for (const [id, item] of this.followers) void this.update(id, item); }, this.options.intervalMs ?? 500);
  }
  private async isOpen(follower: Follower): Promise<boolean> {
    try { return !follower.handle || await follower.handle.isOpen(); } catch { return true; }
  }
  private stopEmptyTimer(): void {
    if (!this.followers.size && this.timer) { clearInterval(this.timer); this.timer = undefined; }
  }
  private async retire(jobId: string, follower: Follower): Promise<boolean> {
    if (!follower.handle || await this.isOpen(follower)) return false;
    try {
      await this.remove(follower.files);
      if (this.followers.get(jobId) === follower) this.followers.delete(jobId);
      follower.closed = true; this.stopEmptyTimer(); return true;
    } catch { return false; }
  }
  private update(jobId: string, follower: Follower): Promise<void> {
    if (follower.pending) return follower.pending;
    const work = (async () => {
      try {
        if (await this.retire(jobId, follower) || follower.closed) return;
        const snapshot = this.disposed ? undefined : this.options.read(jobId);
        const closing = !snapshot || this.disposed;
        await follower.files.write('feed.json', { version: 1, text: this.disposed ? 'Read-only follow closed. The agent is unaffected.' : snapshot ? render(snapshot) : 'This session is no longer available in the active project. The agent is unaffected.', closed: closing });
        if (closing) follower.closed = true;
      } catch { /* A display observer cannot change canonical work or provider outcome. */ }
    })().finally(() => { follower.pending = undefined; });
    follower.pending = work; return work;
  }
  private async remove(files: WorkerFiles): Promise<void> {
    await files.verifyIdentity(); const root = await realpath(tmpdir());
    if (!/^coforge-session-follow-[a-zA-Z0-9_-]{6}$/u.test(relative(root, files.directory))) throw new Error('The original observer directory changed.');
    await rm(files.directory, { recursive: true, force: true });
  }
  private async bounded(work: Promise<unknown>, milliseconds: number): Promise<void> {
    let timer: ReturnType<typeof deadlineTimer> | undefined;
    await Promise.race([work, new Promise<void>(resolve => { timer = deadlineTimer(resolve, milliseconds); })]);
    if (timer) clearTimeout(timer);
  }
  async dispose(): Promise<void> {
    if (this.disposed) return; this.disposed = true;
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    const cleanup = (async () => {
      await Promise.allSettled(this.openings.values());
      await Promise.all([...this.followers].map(async ([id, follower]) => {
        await follower.pending;
        await this.update(id, follower);
        if (!follower.handle) return;
        for (let attempt = 0; attempt < 10 && await this.isOpen(follower); attempt++) await pause(50);
        await this.retire(id, follower);
      }).map(work => work.catch(() => undefined)));
    })();
    // Hung cosmetic I/O cannot delay provider cancellation or plugin disposal; late completion still closes its feed.
    await this.bounded(cleanup, 1000);
  }
}
