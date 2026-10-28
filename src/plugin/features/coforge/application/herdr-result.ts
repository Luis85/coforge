import { record } from '../domain/check';
import { cleanDeep } from '../domain/sanitize';
import { screeningOutput, scoreOutput, planOutput, implementationOutput, stageInput, stageSystemPrompt, STAGE_JSON_SCHEMAS } from './agent-prompts';
import type { StageInput } from './ports';
import type { HerdrWorkflowRecord } from './herdr-workflow-ports';

export const HERDR_RESULT_FORMAT = 'coforge.herdr-stage-result/v1';
export function herdrResultOutput(value: unknown, expected: Pick<HerdrWorkflowRecord, 'id' | 'jobId' | 'ideaId' | 'projectId' | 'stage' | 'fingerprint' | 'nonce'>): unknown {
  const envelope = record(value);
  const keys = ['format', 'attemptId', 'jobId', 'ideaId', 'projectId', 'stage', 'fingerprint', 'nonce', 'output'];
  if (Object.keys(envelope).some(key => !keys.includes(key)) || envelope.format !== HERDR_RESULT_FORMAT || envelope.attemptId !== expected.id || envelope.jobId !== expected.jobId || envelope.ideaId !== expected.ideaId || envelope.projectId !== expected.projectId || envelope.stage !== expected.stage || envelope.fingerprint !== expected.fingerprint || envelope.nonce !== expected.nonce)
    throw new Error('Herdr returned a result for a different or invalid task. The request was not advanced.');
  const output = cleanDeep(envelope.output);
  if (expected.stage === 'screen') return screeningOutput(output);
  if (expected.stage === 'score') return scoreOutput(output);
  if (expected.stage === 'plan') return planOutput(output);
  return implementationOutput(output);
}
export function herdrSystemPrompt(input: Pick<StageInput, 'stage' | 'settings'>, resultPath: string): string {
  return (stageSystemPrompt(input.stage, input.settings) + ` Transport exception: use the permitted Write file tool only to save the final CoForge transport envelope to ${JSON.stringify(resultPath)}. This is the sole result-channel exception to the stage's no-tools/read-only rule. No shell, network, credentials, package installation or Git metadata access is permitted. Save the envelope only after all stage work is complete; never invent executed tests or token/cost reports.`).replace(/\s+/g, ' ').trim();
}
export function herdrTaskPrompt(input: StageInput, task: HerdrWorkflowRecord, resultPath: string): string {
  const envelope = { format: HERDR_RESULT_FORMAT, attemptId: task.id, jobId: task.jobId, ideaId: task.ideaId, projectId: task.projectId, stage: task.stage, fingerprint: task.fingerprint, nonce: task.nonce };
  const prompt = `${stageInput(input.stage, input.idea, input.settings)}\n\nRequired output schema: ${JSON.stringify(STAGE_JSON_SCHEMAS[input.stage])}\n\nFinish this task by writing one JSON file to ${JSON.stringify(resultPath)}. Its envelope is ${JSON.stringify(envelope)} with an additional output property containing the schema object. Do not echo a template as a result. Write the complete final JSON once, after all work, then stop. Do not include cost, tokens or claims that tests ran. Delivery and terminal text do not advance CoForge; only this matching validated artifact can. No merge, push, deploy or approval is authorized.`;
  if (prompt.length > 10000) throw new Error('The complete task exceeds Herdr’s bounded prompt interface. Shorten the project brief/context or choose another workflow provider; no text was truncated or sent.');
  return prompt;
}
