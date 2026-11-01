import type { StageInput } from '../../features/coforge/application/ports';
import { redact } from './process';
import { persistProviderEvidence } from './provider-evidence';

/** The CLI exposes a final result, not its hidden reasoning or complete internal tool conversation. */
export async function captureClaudeResponse(input: StageInput, raw: string): Promise<void> {
  const capture = (text: string) => persistProviderEvidence(() => input.onConversation?.({ kind: 'response', text: redact(text) }));
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { if (raw.trim()) await capture(raw); return; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    await capture(raw); return;
  }
  const structured = 'structured_output' in value ? value.structured_output : undefined;
  const prose = 'result' in value ? value.result : undefined;
  const output = structured !== undefined && typeof prose === 'string' && prose.trim()
    ? { result: prose, structured_output: structured }
    : structured !== undefined ? structured : prose;
  if (output === undefined) {
    if (!('type' in value) || value.type !== 'result') await capture(raw);
    return;
  }
  await capture(typeof output === 'string' ? output : JSON.stringify(output, null, 2));
}
