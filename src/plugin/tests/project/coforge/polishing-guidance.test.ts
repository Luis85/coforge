import { expect, it } from 'vitest';
import { executionSchema, executionSystemPrompt, executionTaskPrompt, validateExecutionOutput } from '../../../features/coforge/application/workflow-execution';
import { standalonePolishingFixture } from './polishing-standalone-fixture';
import { consent } from './background-build-retry-fixture';
import { defaultIntegration, defaultSettings, createSeed } from '../../../features/coforge/domain/seed';
import type { StageInput } from '../../../features/coforge/application/ports';
import { record } from '../../../features/coforge/domain/check';

it('keeps request polishing as replacement body rather than requiring an execution/review report in the proposed description', async () => {
  const f = await standalonePolishingFixture();
  try {
    const feedback = 'Correct grammar only. Keep the request concise.';
    const preview = await f.engine.previewPolishingPass(f.ideaId, feedback); await f.engine.confirmPolishingPass(f.ideaId, preview.id, consent); await f.engine.waitUntilIdle();
    const captured = f.runner.mock.calls.at(-1)![0]; const before = structuredClone(captured.workflow);
    const prompt = executionSystemPrompt(captured);
    expect(prompt).toContain('Return only the polished replacement request text');
    expect(prompt).not.toContain('Within the required markdown field, identify unresolved decisions');
    expect(prompt).not.toContain('Name discovered verification commands only as human follow-up');
    for (const policy of ['No repository tools are available', 'do not provide subagent delegation', 'Do not claim tests passed', 'requires final human review', 'Never access credentials']) expect(prompt).toContain(policy);
    const task = record(record(JSON.parse(executionTaskPrompt(captured))).operatorPolishing);
    expect(task.feedback).toBe(feedback); expect(task.capturedCurrentResult).toBe(captured.workflow!.polishingPayload);
    expect(executionSchema(captured)).toMatchObject({ required: ['markdown'], additionalProperties: false });
    expect(validateExecutionOutput(captured, { markdown: 'The concise replacement request.' })).toEqual({ markdown: 'The concise replacement request.' });
    expect(() => validateExecutionOutput(captured, { markdown: 'Replacement', snapshotHash: 'a'.repeat(64) })).toThrow();
    expect(captured.workflow).toEqual(before); expect(f.current().workflowRun).toBeUndefined();
  } finally { await f.engine.stop(); }
});

it.each(['markdown', 'design'] as const)('retains upstream evidence/reporting guidance for analytical %s and non-request polishing', output => {
  const input: StageInput = { stage: 'plan', idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration(), workflow: {
    runId: 'run', definitionRevision: 'definition', proposalRevision: 'proposal', attemptId: 'attempt', inputArtifacts: [], polishingId: 'polish',
    polishingPayload: JSON.stringify({ kind: output, value: { markdown: '# Actual analytical result' } }), polishingFeedback: 'Clarify the evidence.', polishingSourceHash: 'source',
    step: { id: 'review', name: 'Review', kind: 'ai', output, access: 'none', provider: 'demo', model: 'sonnet', automatic: false, instructions: 'Improve this analytical result.' },
  } };
  const prompt = executionSystemPrompt(input);
  expect(prompt).toContain('Within the required markdown field, identify unresolved decisions'); expect(prompt).toContain('Separate inspected source evidence from prior artifact claims');
  expect(prompt).not.toContain('Return only the polished replacement request text');
});
