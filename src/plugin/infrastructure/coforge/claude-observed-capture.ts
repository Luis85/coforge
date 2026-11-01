import type { StageInput } from '../../features/coforge/application/ports';
import { captureProcess, childEnvironment, ProcessFailure, ProcessOwnershipUnknown, type ProcessOptions } from './process';
import { providerSessionObserver } from './provider-session-stream';
import { ClaudeSessionResult, normalizeClaudeSessionResult } from './claude-stream-result';
import { captureProviderFailure, diagnoseProviderFailure } from './provider-failure';
import { assignProviderFailure, providerFailureInfo, providerFailureFor } from '../../features/coforge/domain/provider-failure';

/** Session capture changes transport framing only. Observation persistence never controls provider execution. */
export async function captureObservedClaude(input: Pick<StageInput, 'onSessionEvent'>, command: string, args: readonly string[], options: ProcessOptions,
  capture: typeof captureProcess = captureProcess, extraRedactionEnv: NodeJS.ProcessEnv = {}): Promise<string> {
  if (!input.onSessionEvent && !options.nativeCoding) { try { return await capture(command, args, options); } catch (error) { throw diagnoseProviderFailure('claude', error, options.signal); } }
  const streaming = [...args]; const format = streaming.indexOf('--output-format');
  if (format >= 0) streaming[format + 1] = 'stream-json'; else streaming.push('--output-format', 'stream-json');
  if (!streaming.includes('--verbose')) streaming.push('--verbose');
  const observer = providerSessionObserver({ provider: 'claude', capture: input.onSessionEvent ?? (async () => {}),
    environment: { ...(options.env ?? childEnvironment()), ...extraRedactionEnv }, privatePaths: [options.cwd] });
  try {
    const raw = await capture(command, streaming, { ...options, stdoutResult: new ClaudeSessionResult(options.maxBytes, Boolean(options.nativeCoding)), onStdout: chunk => {
      observer.push(chunk);
      try { void Promise.resolve(options.onStdout?.(Uint8Array.from(chunk))).catch(() => {}); } catch { /* Other observers remain non-authoritative. */ }
    } });
    return normalizeClaudeSessionResult(raw, Boolean(options.nativeCoding));
  } catch (error) {
    const failure = diagnoseProviderFailure('claude', error, options.signal); await captureProviderFailure(input.onSessionEvent, failure);
    if (failure instanceof ProcessOwnershipUnknown) throw new ProcessOwnershipUnknown(normalizeClaudeSessionResult(failure.output, Boolean(options.nativeCoding)), failure.diagnostic, providerFailureInfo(failure), failure.ownership);
    if (failure instanceof ProcessFailure) throw assignProviderFailure(new ProcessFailure(failure.message, normalizeClaudeSessionResult(failure.output, Boolean(options.nativeCoding)), failure.diagnostic), providerFailureInfo(failure) ?? providerFailureFor('execution_failed'));
    throw failure;
  } finally { await observer.finish().catch(() => {}); }
}
