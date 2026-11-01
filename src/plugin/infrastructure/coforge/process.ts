import { spawn, type ChildProcess } from 'child_process';
import { basename } from 'path';
import { setTimeout as processTimeout, clearTimeout as clearProcessTimeout } from 'node:timers';
import { readNativeProcessIdentity, stopOwnedProcessTree, type NativeProcessIdentity } from './durable-worker/process-identity';

export interface ProcessOptions {
  cwd: string; input?: string; signal?: AbortSignal; timeoutMs?: number; maxBytes?: number; env?: NodeJS.ProcessEnv;
  /** Delegated invocations retain ownership until their original process tree is proven stopped. */
  ownedTree?: true;
  onOwnedProcess?(identity: NativeProcessIdentity, phase: 'launched' | 'terminated' | 'unknown'): Promise<void>;
  /** Internal observation only. Raw bytes must be decoded/sanitized before publication; failures never affect execution. */
  onStdout?(chunk: Uint8Array): void | Promise<void>;
  /** A protocol adapter retains bounded terminal semantics instead of a verbose raw transcript. */
  stdoutResult?: { append(chunk: Uint8Array): void; result(): string };
}
const OUTPUT_LIMIT = 2 * 1024 * 1024;
/** Raw transport output for usage recovery and response extraction. Never expose raw output to UI/logs; extracted evidence must be redacted. */
export class ProcessFailure extends Error { constructor(message: string, readonly output: string) { super(message); this.name = 'ProcessFailure'; } }
export class ProcessOwnershipUnknown extends ProcessFailure {
  /** Private bounded transport diagnostic. Never pass this to UI, model context or structured logs. */
  declare readonly diagnostic?: string;
  constructor(output: string, diagnostic?: string) {
    super('Provider process-tree termination is unverified. The original workspace remains quarantined; inspect it before retrying.', output); this.name = 'ProcessOwnershipUnknown';
    if (diagnostic) Object.defineProperty(this, 'diagnostic', { value: redact(diagnostic).slice(-1800), enumerable: false });
  }
}
const ENVIRONMENT = new Set([
  'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'WINDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'TMP', 'TEMP', 'TMPDIR', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CONFIG_DIR',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'NODE_EXTRA_CA_CERTS',
]);

/** Removes recognizable credentials from process output before it reaches logs or the UI. */
export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let safe = text.replace(/sk-ant-[\w-]+/g, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
  for (const [key, value] of Object.entries(env)) {
    if (value && value.length >= 8 && /TOKEN|SECRET|API_KEY|PASSWORD/i.test(key)) safe = safe.split(value).join('[redacted]');
  }
  return safe;
}

/** The child environment is an allowlist; Obsidian's own variables are not inherited. */
export function childEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(source).filter(([name, value]) => ENVIRONMENT.has(name) && value !== undefined));
}

/** Executes an argv vector, never a shell. Resolves only after the child exits; output and time are bounded. */
export function captureProcess(executable: string, args: readonly string[], options: ProcessOptions): Promise<string> {
  if (options.signal?.aborted) return Promise.reject(new Error('Run cancelled.'));
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(executable, [...args], {
        cwd: options.cwd, env: options.env ?? childEnvironment(), shell: false, windowsHide: true,
        detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) { reject(error instanceof Error ? error : new Error(String(error))); return; }
    const chunks: Buffer[] = []; const errors: Buffer[] = [];
    const output = () => options.stdoutResult?.result() ?? Buffer.concat(chunks).toString('utf8');
    let bytes = 0; let errorBytes = 0; let failure: Error | undefined; let hardKill: ReturnType<typeof processTimeout> | undefined; let finished = false;
    const identity = options.ownedTree && child.pid ? readNativeProcessIdentity(child.pid).catch(() => undefined) : Promise.resolve(undefined);
    const launched = identity.then(async original => { if (original) await options.onOwnedProcess?.(original, 'launched'); });
    let treeStopped = Promise.resolve(true);
    const kill = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try { if (process.platform !== 'win32') process.kill(-child.pid, signal); else child.kill(signal); } catch { /* The child may already have exited. */ }
    };
    const stop = (message: string) => {
      if (failure || finished) return;
      failure = new Error(message);
      if (options.ownedTree) {
        treeStopped = identity.then(async original => original ? (await stopOwnedProcessTree(original)).treeConfirmed : false).catch(() => false);
        hardKill = processTimeout(() => {
          if (finished) return;
          cleanup(); child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy(); child.unref();
          reject(new ProcessOwnershipUnknown(output()));
        }, 15000);
      } else {
        kill('SIGTERM'); hardKill = processTimeout(() => kill('SIGKILL'), 1500);
      }
    };
    const abort = () => stop('Run cancelled.');
    const timeout = processTimeout(() => stop('Run timed out. Review any partial worktree changes before retrying.'), options.timeoutMs ?? 180_000);
    options.signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { finished = true; clearProcessTimeout(timeout); if (hardKill !== undefined) clearProcessTimeout(hardKill); options.signal?.removeEventListener('abort', abort); };
    child.stdout?.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (options.stdoutResult) options.stdoutResult.append(chunk);
      else if (bytes > (options.maxBytes ?? OUTPUT_LIMIT)) stop('Process output exceeded its limit. The run was stopped.');
      else {
        chunks.push(Buffer.from(chunk));
      }
      try { void Promise.resolve(options.onStdout?.(Uint8Array.from(chunk))).catch(() => {}); } catch { /* Observers cannot change provider outcomes. */ }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      errorBytes += chunk.length;
      if (errorBytes <= 64_000) errors.push(Buffer.from(chunk));
      if (errorBytes > OUTPUT_LIMIT) stop('Process error output exceeded its limit. The run was stopped.');
    });
    child.on('error', error => { cleanup(); reject(new Error(`Could not start ${basename(executable)}: ${redact(error.message)}`)); });
    child.on('close', code => {
      void treeStopped.then(async confirmed => {
        if (finished) return;
        try {
          await launched;
          const original = await identity;
          if (original && (failure || code !== 0)) await options.onOwnedProcess?.(original, !confirmed || !failure && code !== 0 ? 'unknown' : 'terminated');
        } catch { cleanup(); reject(new ProcessOwnershipUnknown(output())); return; }
        if (finished) return; cleanup();
        if (!confirmed || options.ownedTree && !failure && code !== 0) reject(new ProcessOwnershipUnknown(output(), redact(Buffer.concat(errors).toString('utf8'), options.env)));
        else if (failure) reject(new ProcessFailure(failure.message, output()));
        else if (code !== 0) reject(new ProcessFailure(`${basename(executable)} exited with code ${String(code)}. ${redact(Buffer.concat(errors).toString('utf8'), options.env).slice(-1800) || 'Check the CLI installation and authentication.'}`, output()));
        else if (Buffer.byteLength(output()) > (options.maxBytes ?? OUTPUT_LIMIT)) reject(new ProcessFailure('Process result exceeded its limit.', ''));
        else resolve(output());
      });
    });
    child.stdin?.on('error', () => { /* An early exit is reported by close. */ });
    if (options.ownedTree) {
      void identity.then(async original => {
        if (!original) { stop('The provider launch identity could not be verified.'); return; }
        try { await launched; } catch { stop('The provider launch authorization could not be committed.'); return; }
        if (!failure && !finished) child.stdin?.end(options.input ?? '');
      });
    } else child.stdin?.end(options.input ?? '');
  });
}
