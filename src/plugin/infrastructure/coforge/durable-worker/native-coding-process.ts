import { randomUUID } from 'node:crypto';
import { captureProcess, ProcessFailure, ProcessOwnershipUnknown, redact, type ProcessOptions } from '../process';
import { assignProviderFailure, providerFailureFor, providerFailureInfo } from '../../../features/coforge/domain/provider-failure';
import type { WorkerFiles } from './files';
import { WorkerOwnershipUnknown, type WorkerHooks } from './service';
import { OutputSpool, ProviderOutput } from './output';
import { ClaudeSessionResult } from '../claude-stream-result';

/** Durable and foreground commands share the same OS lifetime authority; verbosity remains semantic-only. */
export async function captureWorkerNativeCoding(files: WorkerFiles, hooks: WorkerHooks, provider: 'claude' | 'codex', executable: string, args: readonly string[], options: ProcessOptions): Promise<string> {
  const output = options.stdoutResult ?? (provider === 'claude' ? new ClaudeSessionResult(options.maxBytes, Boolean(options.nativeCoding)) : new ProviderOutput(true)); let raw = '';
  try {
    raw = await captureProcess(executable, args, { ...options, stdoutResult: output,
      onOwnedProcess: async (identity, phase, lifetime) => {
        if (phase === 'launched') await hooks.launched(identity.pid, randomUUID(), identity, lifetime);
        await options.onOwnedProcess?.(identity, phase, lifetime);
      },
      onStdout: chunk => {
        try { void Promise.resolve(options.onStdout?.(chunk)).catch(() => {}); } catch { /* Observation cannot affect execution. */ }
        void hooks.activity().catch(() => {});
      },
    });
    await new OutputSpool(files, 'stdout').append(Buffer.from(redact(raw, options.env)));
    await hooks.phase(); return raw;
  } catch (error) {
    if (error instanceof ProcessOwnershipUnknown) throw new WorkerOwnershipUnknown(error.message, providerFailureInfo(error), error.output, error.ownership);
    if (raw && !(error instanceof ProcessFailure)) throw assignProviderFailure(new ProcessFailure('Native command evidence could not be finalized.', raw), providerFailureInfo(error) ?? providerFailureFor('persistence'));
    throw error;
  }
}
