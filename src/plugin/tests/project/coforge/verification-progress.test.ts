import { afterEach, expect, it, vi } from 'vitest';
import { verificationProgress } from '../../../infrastructure/coforge/verification/progress';
import type { AgentSessionEvent } from '../../../features/coforge/domain/agent-session';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';

afterEach(() => vi.unstubAllEnvs());
function fixture(label = 'Checks') {
  const events: AgentSessionEvent[] = [];
  const input: StageInput = { stage: 'implement', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(),
    onSessionEvent: async event => { events.push(event); } };
  const progress = verificationProgress(input, { id: 'check', label, executable: 'node', args: [] }, '/private/snapshot', () => 'PRIVATE_OWNERSHIP_TOKEN');
  return { events, progress };
}
const snapshot = (output: string) => ({ output, truncated: false, interrupted: false });

it('holds an incomplete bearer credential across complete-line updates until it can be redacted', async () => {
  const f = fixture();
  f.progress.observe(snapshot('Authorization: Bearer \n'));
  expect(f.events).toEqual([]);
  f.progress.observe(snapshot('Authorization: Bearer \nSPLIT_OBSERVATION_TOKEN\n'));
  await f.progress.finish();
  expect(JSON.stringify(f.events)).toContain('[redacted]');
  expect(JSON.stringify(f.events)).not.toContain('SPLIT_OBSERVATION_TOKEN');
});

it('applies the same credential and private-path protection to command labels', async () => {
  const f = fixture('Checks /opt/private/checks Bearer LABEL_TOKEN');
  f.progress.observe(snapshot('Observed output\n'));
  await f.progress.finish();
  expect(f.events).toHaveLength(1);
  expect(f.events[0]?.label).not.toContain('/opt/private');
  expect(f.events[0]?.label).not.toContain('LABEL_TOKEN');
  expect(f.events[0]?.label).toContain('[redacted]');
});

it('redacts complete text before chunking, excluding private paths, control sequences and split known secrets', async () => {
  vi.stubEnv('COFORGE_OBSERVATION_SECRET', 'OBSERVATION_SECRET_VALUE');
  const f = fixture();
  f.progress.observe(snapshot('x'.repeat(2040) + 'OBSERVATION_SECRET_VALUE /private/snapshot/source.js PRIVATE_OWNERSHIP_TOKEN ' + String.fromCharCode(27) + '[31mvisible\n'));
  await f.progress.finish();
  expect(f.events.every(event => (event.text?.length ?? 0) <= 2048)).toBe(true);
  expect(JSON.stringify(f.events)).not.toContain('OBSERVATION_SECRET_VALUE');
  expect(JSON.stringify(f.events)).not.toContain('PRIVATE_OWNERSHIP_TOKEN');
  expect(JSON.stringify(f.events)).not.toContain('/private/snapshot');
  expect(JSON.stringify(f.events)).not.toContain('[31m');
  expect(JSON.stringify(f.events)).toContain('visible');
});
