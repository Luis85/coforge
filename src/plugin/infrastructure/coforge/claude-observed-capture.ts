import type { StageInput } from '../../features/coforge/application/ports';
import { captureProcess, childEnvironment, ProcessFailure, ProcessOwnershipUnknown, type ProcessOptions } from './process';
import { providerSessionObserver } from './provider-session-stream';
import { ClaudeSessionResult, normalizeClaudeSessionResult } from './claude-stream-result';

/** Session capture changes transport framing only. Observation persistence never controls provider execution. */
export async function captureObservedClaude(input: Pick<StageInput, 'onSessionEvent'>, command: string, args: readonly string[], options: ProcessOptions,
  capture: typeof captureProcess = captureProcess, extraRedactionEnv: NodeJS.ProcessEnv = {}): Promise<string> {
  if (!input.onSessionEvent) return capture(command, args, options);
  const streaming = [...args]; const format = streaming.indexOf('--output-format');
  if (format >= 0) streaming[format + 1] = 'stream-json'; else streaming.push('--output-format', 'stream-json');
  if (!streaming.includes('--verbose')) streaming.push('--verbose');
  const observer = providerSessionObserver({ provider: 'claude', capture: input.onSessionEvent,
    environment: { ...(options.env ?? childEnvironment()), ...extraRedactionEnv }, privatePaths: [options.cwd] });
  try {
    const raw = await capture(command, streaming, { ...options, stdoutResult: new ClaudeSessionResult(options.maxBytes), onStdout: chunk => {
      observer.push(chunk);
      try { void Promise.resolve(options.onStdout?.(Uint8Array.from(chunk))).catch(() => {}); } catch { /* Other observers remain non-authoritative. */ }
    } });
    return normalizeClaudeSessionResult(raw);
  } catch (error) {
    if (error instanceof ProcessOwnershipUnknown) throw new ProcessOwnershipUnknown(normalizeClaudeSessionResult(error.output), error.diagnostic);
    if (error instanceof ProcessFailure) throw new ProcessFailure(error.message, normalizeClaudeSessionResult(error.output));
    throw error;
  } finally { await observer.finish().catch(() => {}); }
}
