import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as timer, clearTimeout as clearTimer } from 'node:timers';
import { childEnvironment, ProcessFailure, redact, type ProcessOptions } from '../process';
import type { WorkerHooks } from './service';
import { WorkerOwnershipUnknown } from './service';
import { OutputSpool, ProviderOutput } from './output';
import type { WorkerFiles } from './files';
import { readNativeProcessIdentity, stopOwnedProcessTree } from './process-identity';
import { providerFailureFor } from '../../../features/coforge/domain/provider-failure';

/** Node owns the child, pipes and cancellation. No renderer/window object participates. */
export function workerCapture(files: WorkerFiles, hooks: WorkerHooks, provider: 'claude' | 'codex') {
  return async (executable: string, args: readonly string[], options: ProcessOptions): Promise<string> => {
    options.signal?.throwIfAborted();
    return new Promise<string>((resolve, reject) => {
      const child = spawn(executable, [...args], { cwd: options.cwd, env: options.env ?? childEnvironment(), shell: false, windowsHide: true,
        detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
      const output = options.stdoutResult ?? new ProviderOutput(provider === 'codex');
      const stdout = new OutputSpool(files, 'stdout'); const stderr = new OutputSpool(files, 'stderr');
      let pendingOut: Promise<void> = Promise.resolve(); let pendingError: Promise<void> = Promise.resolve();
      let failure: Error | undefined; let finished = false; let stopping = false; let uncertain = false;
      let treeStopped = Promise.resolve(true);
      const identity = child.pid ? readNativeProcessIdentity(child.pid) : Promise.resolve(undefined);
      let errorTail = '';
      let watchdog: ReturnType<typeof timer> | undefined;
      const clean = () => { if (watchdog) clearTimer(watchdog); options.signal?.removeEventListener('abort', abort); };
      const stop = (message: string) => {
        if (stopping || finished) return; stopping = true; failure = new Error(message);
        child.stdin.destroy();
        treeStopped = identity.then(async value => value ? (await stopOwnedProcessTree(value)).treeConfirmed : false).catch(() => false);
        watchdog = timer(() => {
          if (finished) return; finished = true; clean(); child.stdin.destroy(); child.stdout?.destroy(); child.stderr?.destroy(); child.unref();
          reject(new WorkerOwnershipUnknown('Provider termination could not be verified.', providerFailureFor(options.signal?.reason === 'deadline' ? 'timeout' : options.signal?.aborted ? 'cancelled' : 'ownership_unknown', true), output.result()));
        }, 10000);
      };
      const abort = () => stop('Run cancelled. Review retained changes.');
      options.signal?.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', (chunk: Buffer) => {
        child.stdout.pause(); output.append(chunk);
        try { void Promise.resolve(options.onStdout?.(new Uint8Array(chunk))).catch(() => undefined); } catch { /* Observation cannot change provider execution. */ }
        pendingOut = pendingOut.then(async () => { await stdout.append(Buffer.from('Observed stdout bytes: ' + chunk.length + '\n')); await hooks.activity(); }).then(() => { if (!finished) child.stdout.resume(); })
          .catch(() => { stop('Private output could not be persisted.'); });
      });
      child.stderr.on('data', (chunk: Buffer) => {
        child.stderr.pause();
        errorTail = (errorTail + chunk.toString('utf8')).slice(-64000);
        pendingError = pendingError.then(() => stderr.append(Buffer.from('Observed stderr bytes: ' + chunk.length + '\n'))).then(() => { if (!finished) child.stderr.resume(); })
          .catch(() => { stop('Private output could not be persisted.'); });
      });
      child.once('error', () => { if (finished) return; finished = true; clean(); reject(new Error('The configured native provider could not start.')); });
      child.once('close', code => {
        void Promise.all([pendingOut, pendingError]).then(async () => {
          if (finished) return; finished = true; clean();
          if (!await treeStopped) uncertain = true;
          await stdout.append(Buffer.from(redact(output.result(), options.env)));
          await stderr.append(Buffer.from(redact(errorTail, options.env)));
          const original = await identity;
          if (options.ownedTree && failure && !uncertain && original) await options.onOwnedProcess?.(original, 'terminated');
          if (options.ownedTree && uncertain && original) await options.onOwnedProcess?.(original, 'unknown');
          if (uncertain) { reject(new WorkerOwnershipUnknown('The original provider process tree needs inspection.', providerFailureFor(options.signal?.reason === 'deadline' ? 'timeout' : options.signal?.aborted ? 'cancelled' : 'ownership_unknown', true), output.result())); return; }
          if (failure) { reject(new ProcessFailure(failure.message, output.result())); return; }
          if (code !== 0) { reject(new ProcessFailure('Native provider exited without completing this Build.', output.result(), redact(errorTail, options.env))); return; }
          await hooks.phase(); resolve(output.result());
        }).catch(() => { reject(new Error('The provider exited but its evidence could not be finalized.')); });
      });
      child.stdin.on('error', () => {});
      void (async () => {
        if (!child.pid) return;
        const verified = await identity; if (!verified) throw new WorkerOwnershipUnknown('The original provider OS identity is unavailable.');
        await hooks.launched(child.pid, randomUUID(), verified);
        if (options.ownedTree) await options.onOwnedProcess?.(verified, 'launched');
        options.signal?.throwIfAborted();
        child.stdin.end(options.input ?? '');
      })().catch(() => stop('The provider launch identity could not be committed.'));
    });
  };
}
