import { parse, stringify } from 'yaml';
import { record } from '../../../../src/plugin/features/coforge/domain/check';
import { parsePersistedStudio } from '../../../../src/plugin/features/coforge/domain/persisted';
import { parseIdeaNote, ideaProperties } from '../../../../src/plugin/features/coforge/domain/idea-note';
import { splitNote } from '../../../../src/plugin/infrastructure/coforge/markdown';
import { ideaFingerprint } from '../../../../src/plugin/features/coforge/domain/integrity';
import { workflowIntegrityKey, workflowMetadataFingerprint } from '../../../../src/plugin/features/coforge/application/workflow-note-integrity';
import type { WorkflowAiStep } from '../../../../src/plugin/features/coforge/domain/configured-workflow';
import type { NativeWorkflowTools } from '../../../../src/plugin/features/coforge/domain/native-workflow-tools';
import type { AgentJob, Idea } from '../../../../src/plugin/features/coforge/domain/types';
import { worktreeCodingFixture } from './worktree-coding-fixture';

/** Synthetic captured permissions only. No assistant, web request or command is executed. */
export function analyticalToolsFixture(noteText: string, stateText: string) {
  const base = worktreeCodingFixture(noteText, stateText, true);
  const data = parsePersistedStudio(JSON.parse(base.stateText)); const split = splitNote(base.noteText);
  const original = record(parse(split.yaml ?? ''));
  const idea: Idea = { ...parseIdeaNote(original, split.body), voters: [] };
  const run = idea.workflowRun; if (!run) throw new Error('Missing synthetic run.');
  const at = run.createdAt;
  const step: WorkflowAiStep = { id: 'analysis', name: 'SYNTHETIC Refinement', kind: 'ai', output: 'markdown', access: 'readproject',
    provider: 'claude', model: 'sonnet', automatic: false, bucketId: run.definition.steps[0]?.bucketId, instructions: 'Synthetic historical UI permissions; no model ran.' };
  run.definition.steps.unshift({ ...step, nativeTools: { delegation: { maxConcurrent: 6 } } }); run.cursor++;
  const build = run.definition.steps.find(step => step.kind === 'ai' && step.output === 'codechange');
  if (build?.kind === 'ai') build.instructions = 'Custom plugin task.\nDo not execute commands or install dependencies.\nCoForge marks tests as not run.';
  const job = (id: string, tools?: NativeWorkflowTools): AgentJob => ({ id: `synthetic-${id}`, ideaId: idea.id, projectId: idea.projectId,
    stage: 'plan', provider: 'claude', model: 'synthetic-captured-model', status: 'succeeded', startedAt: at, finishedAt: at, logs: [],
    workflow: { runId: run.id, attemptId: `analysis-${id}`, definitionRevision: run.definition.revision, proposalRevision: run.proposalRevision,
      lifecycle: { version: 1, mode: 'managed-session' }, ...(tools ? { analyticalTools: { version: 1, profile: 'scoped-analyst-v1' } } : {}),
      step: { ...step, ...(tools ? { nativeTools: tools } : {}) }, inputArtifacts: [] } });
  const jobs = [job('earlier'), job('current', { delegation: { maxConcurrent: 2 }, research: true }), job('disabled', { delegation: false, research: false })];
  run.attempts.unshift(...jobs.map(job => ({ id: job.workflow!.attemptId, jobId: job.id, stepId: step.id, stepName: step.name,
    kind: 'ai' as const, status: 'succeeded' as const, inputs: [], startedAt: at, finishedAt: at })));
  data.jobs.unshift(...jobs);
  const preparedNote = `---\n${stringify({ ...original, ...ideaProperties(idea, 'Synthetic renderer owner') })}---\n${split.body}`;
  const reread = parseIdeaNote(record(parse(splitNote(preparedNote).yaml ?? '')), split.body);
  data.integrity[idea.id] = ideaFingerprint(reread); data.integrity[workflowIntegrityKey(idea)] = workflowMetadataFingerprint(reread);
  return { noteText: preparedNote, stateText: JSON.stringify(parsePersistedStudio(JSON.parse(JSON.stringify(data))), null, 2) };
}
