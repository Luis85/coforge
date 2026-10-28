import { record } from '../domain/check';
import { cleanDeep } from '../domain/sanitize';
import { screeningOutput, scoreOutput, planOutput, implementationOutput, stageInput, stageSystemPrompt, STAGE_JSON_SCHEMAS } from './agent-prompts';
import type { StageInput } from './ports';
import type { HerdrWorkflowRecord } from './herdr-workflow-ports';
import { executionSchema, executionSystemPrompt, executionTaskPrompt, validateExecutionOutput } from './workflow-execution';

export const HERDR_RESULT_FORMAT = 'coforge.herdr-stage-result/v1';
export class HerdrTaskPromptError extends Error {}
type ResultRecord = Pick<HerdrWorkflowRecord, 'id' | 'jobId' | 'ideaId' | 'projectId' | 'stage' | 'fingerprint' | 'nonce' | 'workflow' | 'workspaceId'>;
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const a = record(left); const b = record(right);
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}
export function herdrResultEnvelope(task: ResultRecord): object {
  return { format: task.workflow ? 'coforge.herdr-step-result/v2' : HERDR_RESULT_FORMAT, attemptId: task.id, jobId: task.jobId, ideaId: task.ideaId, projectId: task.projectId, stage: task.stage, fingerprint: task.fingerprint, nonce: task.nonce,
    ...(task.workflow ? { workflow: { runId: task.workflow.runId, definitionRevision: task.workflow.definitionRevision, proposalRevision: task.workflow.proposalRevision,
      stepId: task.workflow.step.id, attemptId: task.workflow.attemptId, workspaceId: task.workspaceId ?? null,
      inputs: task.workflow.inputArtifacts.map(artifact => ({ id: artifact.id, hash: artifact.contentHash })) } } : {}) };
}
export function herdrResultOutput(value: unknown, expected: ResultRecord): unknown {
  const envelope = record(value);
  const correlation = record(herdrResultEnvelope(expected));
  if (Object.keys(envelope).some(key => key !== 'output' && !Object.hasOwn(correlation, key)) || Object.keys(correlation).some(key => !Object.hasOwn(envelope, key) || !sameValue(envelope[key], correlation[key])))
    throw new Error('Herdr returned a result for a different or invalid task. The request was not advanced.');
  const output = cleanDeep(envelope.output);
  if (expected.workflow) return validateExecutionOutput({ stage: expected.stage, workflow: expected.workflow }, output);
  if (expected.stage === 'screen') return screeningOutput(output);
  if (expected.stage === 'score') return scoreOutput(output);
  if (expected.stage === 'plan') return planOutput(output);
  return implementationOutput(output);
}
export function herdrSystemPrompt(input: Pick<StageInput, 'stage' | 'settings' | 'workflow'>, resultPath: string): string {
  return ((input.workflow ? executionSystemPrompt(input) : stageSystemPrompt(input.stage, input.settings)) + ` Transport exception: use the permitted Write file tool only to save the final CoForge transport envelope to ${JSON.stringify(resultPath)}. This is the sole result-channel exception to the stage's no-tools/read-only rule. No shell, network, credentials, package installation or Git metadata access is permitted. Save the envelope only after all stage work is complete; never invent executed tests or token/cost reports.`).replace(/\s+/g, ' ').trim();
}
export function herdrTaskPrompt(input: StageInput, task: HerdrWorkflowRecord, resultPath: string): string {
  const envelope = herdrResultEnvelope(task);
  const prompt = `${input.workflow ? executionTaskPrompt(input) : stageInput(input.stage, input.idea, input.settings)}\n\nRequired output schema: ${JSON.stringify(input.workflow ? executionSchema(input) : STAGE_JSON_SCHEMAS[input.stage])}\n\nFinish this task by writing one JSON file to ${JSON.stringify(resultPath)}. Its envelope is ${JSON.stringify(envelope)} with an additional output property containing the schema object. Do not echo a template as a result. Write the complete final JSON once, after all work, then stop. Do not include cost, tokens or claims that tests ran. Delivery and terminal text do not advance CoForge; only this matching validated artifact can. No merge, push, deploy or approval is authorized.`;
  if (prompt.length > 10000) throw new HerdrTaskPromptError('The complete task exceeds Herdr’s bounded prompt interface. Shorten the project brief/context or choose another workflow provider; no text was truncated or sent.');
  return prompt;
}
