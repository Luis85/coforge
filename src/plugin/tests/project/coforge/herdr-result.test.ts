import { expect, it } from 'vitest';
import { herdrResultOutput, HERDR_RESULT_FORMAT, herdrTaskPrompt, herdrSystemPrompt } from '../../../features/coforge/application/herdr-result';
import { defaultSettings, defaultIntegration } from '../../../features/coforge/domain/seed';
import type { HerdrWorkflowRecord } from '../../../features/coforge/application/herdr-workflow-ports';
import { createSeed } from '../../../features/coforge/domain/seed';
const expected: HerdrWorkflowRecord = { id: 'attempt-one', jobId: 'job-one', ideaId: 'CF-101', projectId: 'CFP-001', stage: 'screen', model: 'sonnet', kind: 'claude', settings: { executable: 'herdr', session: 'default' }, fingerprint: 'revision-one', nonce: 'nonce-one', at: new Date().toISOString(), phase: 'waiting-result' };
const output = { verdict: 'clear', reason: 'Fits the project.', signals: [] };
const envelope = () => ({ format: HERDR_RESULT_FORMAT, attemptId: expected.id, jobId: expected.jobId, ideaId: expected.ideaId, projectId: expected.projectId, stage: expected.stage, fingerprint: expected.fingerprint, nonce: expected.nonce, output });
it('requires exact task/project/revision/nonce correlation and schema, never terminal or usage claims', () => {
  expect(herdrResultOutput(envelope(), expected)).toEqual(output);
  for (const key of ['attemptId', 'jobId', 'ideaId', 'projectId', 'stage', 'fingerprint', 'nonce']) expect(() => herdrResultOutput({ ...envelope(), [key]: 'wrong' }, expected)).toThrow();
  expect(() => herdrResultOutput({ ...envelope(), usage: { inputTokens: 100 } }, expected)).toThrow();
  expect(() => herdrResultOutput({ ...envelope(), output: { ...output, verdict: 'approved' } }, expected)).toThrow();
  expect(() => herdrResultOutput('a terminal echo', expected)).toThrow();
});
it('separates trusted stage policy, viewer context and the bounded artifact transport exception', () => {
  const input = { stage: 'screen' as const, idea: createSeed().ideas[0]!, settings: defaultSettings(), integration: defaultIntegration() };
  const prompt = herdrTaskPrompt(input, expected, '/private/result.json');
  expect(prompt).toContain(expected.nonce); expect(prompt).toContain('Required output schema'); expect(prompt).toContain('untrustedCommunityProposal');
  expect(herdrSystemPrompt(input, '/private/result.json')).toContain('sole result-channel exception');
  expect(herdrSystemPrompt(input, '/private/result.json')).not.toContain('\n');
  expect(() => herdrTaskPrompt({ ...input, settings: { ...input.settings, projectBrief: 'x'.repeat(10001) } }, expected, '/private/result.json')).toThrow('exceeds');
});
