import { afterEach, expect, it, vi } from 'vitest';
import { McpStepRunner } from '../../../features/coforge/application/mcp-step-runner';
import type { StageInput } from '../../../features/coforge/application/ports';
import { createSeed, defaultIntegration, defaultSettings } from '../../../features/coforge/domain/seed';
import { nodeTimers } from './memory-storage';

afterEach(() => { vi.useRealTimers(); });
async function fixture(managed: boolean) {
  vi.useFakeTimers();
  const input: StageInput = { jobId: 'refinement', stage: 'plan', idea: { ...createSeed().ideas[0]!, projectId: 'CFP-001' },
    settings: { ...defaultSettings(), timeoutSeconds: 15, maxTurns: 1, maxBudgetUsd: 0.1 }, integration: defaultIntegration(),
    workflow: { runId: 'run', attemptId: 'attempt', definitionRevision: 'definition', proposalRevision: 'proposal', inputArtifacts: [],
      ...(managed ? { lifecycle: { version: 1, mode: 'managed-session' } } : {}),
      step: { id: 'refine', kind: 'ai', name: 'Refinement', instructions: 'Refine the design.', access: 'readproject', output: 'markdown', provider: 'claude', model: 'sonnet', automatic: false } } };
  const release = vi.fn(async () => {}); const timers = nodeTimers(); const deadline = vi.spyOn(timers, 'setTimeout');
  const runner = new McpStepRunner({ start: async () => {}, acknowledge: async () => {}, assertReviewable: async () => {},
    acquire: async () => ({ cwd: '/snapshot', readOnly: true, capture: async () => undefined, release }) }, timers);
  const completion = runner.run(input); void completion.catch(() => undefined);
  await vi.waitFor(() => { expect(runner.tasks('CFP-001')).toHaveLength(1); });
  return { runner, completion, deadline, release };
}

it('keeps a quiet managed refinement available through a full day and completes only on its submitted result', async () => {
  const f = await fixture(true);
  try {
    await vi.advanceTimersByTimeAsync(86400000);
    expect(f.runner.tasks('CFP-001')).toHaveLength(1); expect(f.deadline).not.toHaveBeenCalled();
    expect(f.runner.context('CFP-001', 'refinement')).toMatchObject({ lifecycle: { version: 1, mode: 'managed-session' } });
    await f.runner.complete('CFP-001', 'refinement', { markdown: '# Refined design' });
    expect(await f.completion).toMatchObject({ markdown: '# Refined design' });
    expect(f.release).toHaveBeenCalledWith();
  } finally { await f.runner.dispose(); await f.completion.catch(() => undefined); }
});

it('retains the captured legacy timeout and never fabricates external-client liveness from an HTTP reply', async () => {
  const f = await fixture(false);
  try {
    expect(f.runner.context('CFP-001', 'refinement')).not.toHaveProperty('connected');
    await vi.advanceTimersByTimeAsync(15000);
    await expect(f.completion).rejects.toMatchObject({ failure: { code: 'timeout' } });
    expect(f.runner.tasks('CFP-001')).toHaveLength(0);
  } finally { await f.runner.dispose(); await f.completion.catch(() => undefined); }
});
it('retains recovery consent when the host connection ends because owned-command cessation cannot prove an external client stopped', async () => {
  const f = await fixture(true);
  await f.runner.dispose();
  await expect(f.completion).rejects.toMatchObject({ failure: { code: 'transport' } });
  expect(f.release).toHaveBeenCalledWith(true);
});
