import type { StageInput } from '../../../features/coforge/application/ports';
import type { WorkflowVerificationCommand } from '../../../features/coforge/domain/native-workflow-tools';
import { boundedSessionSink } from '../session-observation-sink';
import { sessionTextSanitizer } from '../provider-session-safety';
import type { VerificationOutput } from './docker-attach';

/** Observe complete output lines only: partial credentials and UTF-8 sequences never become live text. */
export function verificationProgress(input: StageInput, command: WorkflowVerificationCommand, directory: string, token: () => string) {
  const sink = boundedSessionSink(input.onSessionEvent);
  let cursor = 0; let emittedAt = 0; let latest = '';
  const observe = (snapshot: VerificationOutput, complete = false) => {
    latest = snapshot.output;
    if (!input.onSessionEvent) return;
    const end = complete ? latest.length : latest.lastIndexOf('\n') + 1;
    if (end <= cursor || !complete && cursor > 0 && end - cursor < 512 && Date.now() - emittedAt < 500) return;
    const sanitize = sessionTextSanitizer({}, [directory, token()]);
    let output = sanitize(latest.slice(cursor, end), 8192);
    if (!complete && /\bBearer\s*$/iu.test(output)) return;
    if (snapshot.truncated) sink.lost();
    cursor = end; emittedAt = Date.now();
    while (output) {
      const text = output.slice(0, 2048).replace(/[\uD800-\uDBFF]$/u, '');
      if (!text) break;
      sink.emit({ kind: 'tool', tool: 'coforge_run_tests', label: sanitize(command.label, 160) || 'Verification output', text });
      output = output.slice(text.length);
    }
  };
  return { observe, async finish(output?: VerificationOutput) { observe(output ?? { output: latest, truncated: false, interrupted: false }, true); await sink.finish(); } };
}
