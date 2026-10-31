import type { IntegrationSettings } from '../../features/coforge/domain/types';
import { probeClaude } from './claude-runner';
import { probeCodex } from './codex-executable';

export async function probeNativeRuntimes(integration: IntegrationSettings) {
  const [claude, codexAvailable] = await Promise.all([probeClaude(integration), probeCodex(integration.codexBin)]);
  return { ...claude, codexAvailable };
}
