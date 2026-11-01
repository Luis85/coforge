import { CheckError } from '../../features/coforge/domain/check';
import { assignProviderFailure, ProviderFailureError, providerFailureFor, providerFailureInfo, providerFailureMessage, type ProviderFailureInfo } from '../../features/coforge/domain/provider-failure';
import { classifyProviderFailure } from '../../features/coforge/application/provider-failure-classification';
import { rootCodexEvents } from '../../features/coforge/application/codex-events';
import { ProcessFailure, ProcessOwnershipUnknown } from './process';
import { boundedSessionSink } from './session-observation-sink';
import type { AgentSessionEvent } from '../../features/coforge/domain/agent-session';

function outputFailure(provider: 'claude' | 'codex', raw: string): ProviderFailureInfo | undefined {
  try {
    if (provider === 'claude') {
      const result: unknown = JSON.parse(raw);
      if (result && typeof result === 'object' && 'type' in result && result.type === 'result' && 'is_error' in result && result.is_error === true)
        return classifyProviderFailure('claude', { subtype: 'subtype' in result ? result.subtype : undefined, failureCode: 'coforge_failure_code' in result ? result.coforge_failure_code : undefined, errors: 'errors' in result ? result.errors : undefined });
    } else {
      const events = rootCodexEvents(raw).events;
      for (const event of [...events].reverse()) if (event.type === 'error' || event.type === 'turn.failed') {
        const classified = classifyProviderFailure('codex', { code: event.code, message: event.message, errors: event.error }); if (classified) return classified;
      }
    }
  } catch { /* No trusted error envelope was captured. */ }
  return undefined;
}
/** Keeps ownership uncertainty and private evidence types while exposing only fixed, supported diagnostic text. */
export function diagnoseProviderFailure(provider: 'claude' | 'codex', error: unknown, signal?: AbortSignal): Error {
  const previous = providerFailureInfo(error);
  let info = previous;
  if (!info && error instanceof ProcessFailure) {
    if (error.message.startsWith('Run cancelled.')) info = providerFailureFor('cancelled');
    else if (error.message.startsWith('Run timed out.')) info = providerFailureFor('timeout');
    else info = outputFailure(provider, error.output) ?? classifyProviderFailure(provider, { message: error.diagnostic });
  }
  if (!info && error instanceof CheckError) info = providerFailureFor('output_validation');
  if (!info && error instanceof SyntaxError) info = providerFailureFor('output_validation');
  if (!info && error instanceof Error && error.message.startsWith('Could not start ')) info = providerFailureFor('installation');
  if (!info && error instanceof Error && /^(?:Codex reached its captured tool-call limit|The captured Codex tool-call limit|The captured verification run limit)/u.test(error.message)) info = providerFailureFor('tool_limit');
  if (!info && signal?.aborted) info = providerFailureFor(signal.reason === 'deadline' ? 'timeout' : 'cancelled');
  info ??= providerFailureFor(error instanceof ProcessOwnershipUnknown ? 'ownership_unknown' : 'execution_failed');
  if (error instanceof ProcessOwnershipUnknown) {
    info = providerFailureFor(info.code, true); assignProviderFailure(error, info); error.message = providerFailureMessage(info, true); return error;
  }
  if (error instanceof ProcessFailure) { assignProviderFailure(error, info); error.message = providerFailureMessage(info); return error; }
  if (previous && error instanceof Error) return error;
  return new ProviderFailureError(info);
}
/** Cleanup must not erase a recorded provider cause, and a recorded cause must never erase unknown ownership. */
export function preserveProviderFailure(earlier: unknown, later: unknown): unknown {
  const first = providerFailureInfo(earlier), next = providerFailureInfo(later);
  const uncertain = earlier instanceof ProcessOwnershipUnknown ? earlier : later instanceof ProcessOwnershipUnknown ? later : undefined;
  if (uncertain) {
    const specific = next && ['persistence', 'workspace_validation'].includes(next.code) ? next : first && !['ownership_unknown', 'execution_failed'].includes(first.code) ? first : next;
    const info = providerFailureFor(specific?.code ?? 'ownership_unknown', true);
    assignProviderFailure(uncertain, info); uncertain.message = providerFailureMessage(info, true); return uncertain;
  }
  return first && !next ? earlier : later;
}
export async function captureProviderFailure(capture: ((event: AgentSessionEvent) => Promise<void>) | undefined, error: unknown): Promise<void> {
  const info = providerFailureInfo(error); if (!info || !capture) return;
  const sink = boundedSessionSink(capture);
  sink.emit({ kind: 'notice', label: 'Recorded failure', text: providerFailureMessage(info, error instanceof ProcessOwnershipUnknown) });
  await sink.finish();
}
