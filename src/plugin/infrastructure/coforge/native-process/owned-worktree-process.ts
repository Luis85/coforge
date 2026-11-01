import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { setTimeout as deadlineTimer, clearTimeout } from 'node:timers';
import { setTimeout as pause } from 'node:timers/promises';
import type { NativeWorkflowLifetimeRef } from '../../../features/coforge/domain/native-workflow-lifetime';
import { readNativeProcessIdentity, sameNativeProcessIdentity, type NativeProcessIdentity } from '../durable-worker/process-identity';
import { nativeSystemEnvironment, prepareWindowsJob, windowsControllerExecutable } from './windows-controller';
import { inspectOwnedWorktreeLifetime, ownedLifetimeFiles, type OwnedProcessReason } from './lifetime-receipt';
import { ownedNativeExecutable } from './native-executable';
import { OwnedWorktreeError, type OwnedWorktreeFailureCode } from './errors';
export { inspectOwnedWorktreeLifetime } from './lifetime-receipt';
export { OwnedWorktreeError } from './errors';

export interface OwnedWorktreeOptions {
  cwd: string; env?: NodeJS.ProcessEnv; input?: string; signal?: AbortSignal;
  /** Trusted shell adapter only, equivalent to Node windowsVerbatimArguments; native SDK argv stays encoded. */
  windowsVerbatimArguments?: boolean;
  owner: { runId: string; attemptId: string; projectId: string };
  onStarted(identity: NativeProcessIdentity, lifetime: NativeWorkflowLifetimeRef): Promise<void>;
  onStdout?(chunk: Uint8Array): void | Promise<void>;
  onStderr?(chunk: Uint8Array): void | Promise<void>;
}
export interface OwnedWorktreeResult { exitCode: number | null; reason: OwnedProcessReason; quiescent: boolean; startedAt: string; finishedAt: string; failureCode?: OwnedWorktreeFailureCode }
export interface OwnedWorktreeProcess {
  identity: NativeProcessIdentity; lifetime: NativeWorkflowLifetimeRef; result: Promise<OwnedWorktreeResult>;
  stop(reason?: 'cancelled' | 'timeout' | 'owner-lost'): Promise<OwnedWorktreeResult>;
  snapshot(): { state: 'running' | 'completed' | 'unknown'; exitCode?: number | null; startedAt: string; finishedAt?: string };
}
const observe = (callback: OwnedWorktreeOptions['onStdout'], bytes: Buffer) => { try { void Promise.resolve(callback?.(Uint8Array.from(bytes))).catch(() => {}); } catch { /* Display output never controls the command. */ } };
/** One current-user OS job; no shell interpolation, input mutation, child-agent orchestration or replay. */
export async function startOwnedWorktreeProcess(executable: string, args: readonly string[], options: OwnedWorktreeOptions): Promise<OwnedWorktreeProcess> {
  if (process.platform !== 'win32') throw new OwnedWorktreeError('unsupported_platform');
  options.signal?.throwIfAborted();
  if (!Array.isArray(args) || args.some(value => typeof value !== 'string' || value.includes('\0')) || Buffer.byteLength(options.input ?? '') > 8 * 1024 * 1024) throw new OwnedWorktreeError('invalid_invocation');
  const command = await ownedNativeExecutable(executable); const cwd = await realpath(options.cwd).catch(() => { throw new OwnedWorktreeError('invalid_invocation'); });
  const prepared = await prepareWindowsJob(options.owner, options.signal); const startedAt = new Date().toISOString();
  const parent = await readNativeProcessIdentity(process.pid); if (!parent) throw new Error('Original native command owner identity is unavailable.');
  const child = spawn(prepared.executable, [prepared.files.directory], { cwd: prepared.files.directory, env: options.env ?? nativeSystemEnvironment(), shell: false, windowsHide: true, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let identity: NativeProcessIdentity | undefined; let finished: OwnedWorktreeResult | undefined; let bootstrapped = false;
  let requested: 'cancelled' | 'timeout' | 'owner-lost' | undefined;
  let resolveExit: () => void = () => {}; const exited = new Promise<void>(resolve => { resolveExit = resolve; });
  child.stdout.on('data', (bytes: Buffer) => observe(options.onStdout, bytes)); child.stderr.on('data', (bytes: Buffer) => observe(options.onStderr, bytes));
  child.once('error', resolveExit); child.once('close', resolveExit); child.stdin.on('error', () => {});
  const result = (async (): Promise<OwnedWorktreeResult> => {
    await exited;
    const receipt = identity ? await inspectOwnedWorktreeLifetime(identity, prepared.lifetime) : undefined;
    finished = { exitCode: receipt?.rootPid ? receipt.rootExitCode : null, reason: receipt ? requested ?? receipt.reason : 'unknown', quiescent: !!receipt,
      startedAt, finishedAt: receipt?.finishedAt ?? new Date().toISOString(), ...(!receipt ? { failureCode: 'ownership_unknown' as const } : receipt.reason === 'start-failed' ? { failureCode: 'startup_failed' as const } : {}) };
    return finished;
  })();
  const stop = async (reason: 'cancelled' | 'timeout' | 'owner-lost' = 'cancelled') => {
    if (finished) return finished;
    requested ??= reason;
    if (!bootstrapped) child.stdin.end();
    else child.stdin.write((reason === 'cancelled' ? 'cancel' : reason) + '\n');
    let timer: ReturnType<typeof deadlineTimer> | undefined;
    const outcome = await Promise.race([result, new Promise<OwnedWorktreeResult>(resolve => { timer = deadlineTimer(() => resolve({ exitCode: null, reason: 'unknown', quiescent: false, startedAt, finishedAt: new Date().toISOString() }), 12000); })]);
    if (timer) clearTimeout(timer); return outcome;
  };
  const abort = () => { void stop(options.signal?.reason === 'deadline' ? 'timeout' : 'cancelled'); };
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    identity = child.pid ? await readNativeProcessIdentity(child.pid) : undefined;
    if (!identity) throw new Error('Original native lifetime controller identity is unavailable.');
    await options.onStarted(identity, prepared.lifetime);
    const frame = { executable: command, args, cwd, input: Buffer.from(options.input ?? '').toString('base64'), parentPid: parent.pid, parentBirth: parent.birth, windowsVerbatimArguments: options.windowsVerbatimArguments === true };
    if (!options.signal?.aborted && !requested) { bootstrapped = true; child.stdin.write(JSON.stringify(frame) + '\n'); }
    const deadline = Date.now() + 10000;
    while (!finished && Date.now() < deadline) {
      const started = await prepared.files.read('started.json', 1024);
      if (started && typeof started === 'object' && 'ownerToken' in started && started.ownerToken === prepared.lifetime.ownerToken) break;
      await pause(20);
    }
    if (!finished && Date.now() >= deadline) throw new Error('Native command startup did not settle.');
  } catch (error) {
    child.stdin.end(); const stopped = await stop('owner-lost'); options.signal?.removeEventListener('abort', abort);
    if (!stopped.quiescent) throw new OwnedWorktreeError('ownership_unknown', { identity, lifetime: prepared.lifetime });
    throw error;
  }
  if (options.signal?.aborted) abort();
  void result.then(() => options.signal?.removeEventListener('abort', abort));
  return { identity, lifetime: prepared.lifetime, result, stop,
    snapshot: () => finished ? { state: finished.quiescent ? 'completed' : 'unknown', exitCode: finished.exitCode, startedAt, finishedAt: finished.finishedAt } : { state: 'running', startedAt } };
}

/** Recovery reads the original receipt, never dispatches again or kills a guessed/reused PID. */
export async function recoverOwnedWorktreeLifetime(identity: NativeProcessIdentity, lifetime: NativeWorkflowLifetimeRef) {
  const known = await inspectOwnedWorktreeLifetime(identity, lifetime); if (known) return known;
  try {
    await ownedLifetimeFiles(lifetime);
    const current = await readNativeProcessIdentity(identity.pid);
    if (!current || !sameNativeProcessIdentity(identity, current)) return undefined;
    const executable = await windowsControllerExecutable();
    await new Promise<void>((resolve, reject) => execFile(executable, ['--recover', lifetime.directory, String(identity.pid), identity.birth, identity.image],
      { env: nativeSystemEnvironment(), windowsHide: true, timeout: 15000, maxBuffer: 4000 }, error => error ? reject(new Error('Original native command recovery is unverified.')) : resolve()));
    return inspectOwnedWorktreeLifetime(identity, lifetime);
  } catch { return undefined; }
}
