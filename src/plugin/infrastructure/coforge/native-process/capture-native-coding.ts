import { childEnvironment, ProcessFailure, ProcessOwnershipUnknown, redact, type ProcessOptions } from '../process';
import { assignProviderFailure, providerFailureFor, providerFailureInfo } from '../../../features/coforge/domain/provider-failure';
import { startOwnedWorktreeProcess, type OwnedWorktreeProcess } from './owned-worktree-process';
import { setTimeout as deadlineTimer, clearTimeout } from 'node:timers';
import { OwnedWorktreeError } from './errors';

/** Native SDK interpretation stays in the provider adapter; this proves lifetime and preserves raw protocol bytes only. */
export async function captureNativeCoding(executable: string, args: readonly string[], options: ProcessOptions): Promise<string> {
  if (!options.nativeCoding || !options.onOwnedProcess) throw new Error('Native coding requires a captured owner and durable process callback.');
  const observeProcess = options.onOwnedProcess;
  const limit = options.maxBytes ?? 2 * 1024 * 1024; const chunks: Buffer[] = []; const errors: Buffer[] = [];
  let bytes = 0, errorBytes = 0, overflow = false; const owned: { current?: OwnedWorktreeProcess } = {};
  const output = () => options.stdoutResult?.result() ?? Buffer.concat(chunks).toString('utf8');
  const process = await startOwnedWorktreeProcess(executable, args, { cwd: options.cwd, env: options.env ?? childEnvironment(), input: options.input,
    watchRootOutputClosure: options.managedSession === true,
    owner: options.nativeCoding, signal: options.signal,
    onStarted: async (identity, lifetime) => {
      try { await observeProcess(identity, 'launched', lifetime); }
      catch (error) { throw new ProcessOwnershipUnknown(output(), undefined, providerFailureInfo(error) ?? providerFailureFor('persistence', true)); }
    },
    onStdout: chunk => {
      if (options.stdoutResult) options.stdoutResult.append(chunk);
      else { bytes += chunk.length; if (bytes <= limit) chunks.push(Buffer.from(chunk)); else { overflow = true; void owned.current?.stop('cancelled'); } }
      try { void Promise.resolve(options.onStdout?.(Uint8Array.from(chunk))).catch(() => {}); } catch { /* Observation cannot affect execution. */ }
    },
    onStderr: chunk => { errorBytes += chunk.length; if (errorBytes <= 64000) errors.push(Buffer.from(chunk)); if (errorBytes > 2 * 1024 * 1024) { overflow = true; void owned.current?.stop('cancelled'); } },
  }).catch(error => {
    if (error instanceof OwnedWorktreeError && error.code === 'ownership_unknown' && error.lifetime)
      throw new ProcessOwnershipUnknown(output(), undefined, providerFailureInfo(error), { identity: error.identity, lifetime: error.lifetime });
    throw error;
  });
  owned.current = process; if (overflow) void process.stop('cancelled');
  const timer = options.timeoutMs === undefined ? undefined : deadlineTimer(() => { void process.stop('timeout'); }, options.timeoutMs);
  const result = await process.result; if (timer) clearTimeout(timer);
  const raw = output();
  if (!result.quiescent) {
    let failure = providerFailureFor('ownership_unknown', true);
    try { await observeProcess(process.identity, 'unknown', process.lifetime); }
    catch (error) { failure = providerFailureInfo(error) ?? providerFailureFor('persistence', true); }
    throw new ProcessOwnershipUnknown(raw, redact(Buffer.concat(errors).toString('utf8'), options.env), failure, { identity: process.identity, lifetime: process.lifetime });
  }
  try { await observeProcess(process.identity, 'terminated', process.lifetime); }
  catch (error) { throw new ProcessOwnershipUnknown(raw, undefined, providerFailureInfo(error) ?? providerFailureFor('persistence', true), { identity: process.identity, lifetime: process.lifetime }); }
  if (result.reason !== 'completed' || result.exitCode !== 0 || overflow || Buffer.byteLength(raw) > limit) {
    const cause = result.reason === 'cancelled' ? 'cancelled' : result.reason === 'timeout' ? 'timeout' : result.reason === 'transport-closed' ? 'incomplete_output' : result.reason === 'start-failed' ? 'installation' : 'execution_failed';
    const error = new ProcessFailure(result.reason === 'cancelled' ? 'Run cancelled.' : result.reason === 'timeout' ? 'Run timed out. Review retained changes.' : 'Native command did not complete successfully.', raw,
      redact(Buffer.concat(errors).toString('utf8'), options.env));
    assignProviderFailure(error, providerFailureFor(cause)); throw error;
  }
  return raw;
}
