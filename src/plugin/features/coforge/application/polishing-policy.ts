import { contextEventId } from '../domain/integrity';
import { workflowProposalRevision, workflowSerializedSize, WORKFLOW_HISTORY_LIMIT_BYTES } from '../domain/configured-workflow-run';
import { workflowRunHistoryHash } from '../domain/workflow-run-history-hash';
import { findProject, ideaProjectId } from '../domain/projects';
import { selectPolishingTarget } from '../domain/polishing-target';
import { cleanText } from '../domain/sanitize';
import { isActiveJob } from '../domain/workflow';
import type { Idea } from '../domain/types';
import type { PolishingCheckpoint, PolishingRun } from '../domain/polishing';
import type { InternalState } from './ports';
import { assertPolishingMetadata, assertPolishingResolved, workflowRunOwner } from './workflow-run-owner';
import { configuredInputs } from './configured-workflow-policy';
import { uncertainTaskAttempt } from './agent-task';
import { workflowIntegrityKey } from './workflow-note-integrity';

export function polishingCheckpoint(idea: Idea): PolishingCheckpoint | undefined {
  const run = idea.workflowRun;
  return run ? { runId: run.id, revision: run.revision, cursor: run.cursor, state: run.state, contentHash: workflowRunHistoryHash(run) } : undefined;
}
export function assertPolishingSource(idea: Idea, pass: PolishingRun): void {
  const target = selectPolishingTarget(idea);
  if (JSON.stringify(polishingCheckpoint(idea)) !== JSON.stringify(pass.primaryCheckpoint) || target.identity !== pass.target.identity || target.contentHash !== pass.target.contentHash ||
      target.proposalRevision !== pass.target.proposalRevision) throw new Error('The polishing source or primary checkpoint changed. Inspect the retained result before applying it.');
}
export function polishingContext(state: InternalState, ideaId: string, feedback: string, busy: boolean) {
  assertPolishingMetadata(state, ideaId);
  const idea = state.ideas.find(item => item.id === ideaId); if (!idea) throw new Error('Request not found.');
  if (!idea.workflowRun && Object.hasOwn(state.integrity, workflowIntegrityKey(idea))) throw new Error('Restore the original managed workflow metadata before polishing this request.');
  const project = findProject(state, ideaProjectId(idea)); if (project.unavailable) throw new Error('Restore the project before polishing its results.');
  const configuration = project.settings.workflow?.improvementPass; if (!configuration) throw new Error('Enable Improve & polish in Workflow settings first.');
  const text = cleanText(feedback, 8000).trim(); if (!text) throw new Error('Provide feedback for this polishing pass.');
  assertPolishingResolved(idea);
  if (busy || state.jobs.some(job => job.ideaId === ideaId && (isActiveJob(job) || job.durable && !job.durable.acknowledged))) throw new Error('Settle the active or unknown original executor before polishing.');
  const main = idea.workflowRun;
  if (main?.state === 'running' || main?.attempts.some(attempt => uncertainTaskAttempt(attempt) || attempt.id === main.activeAttemptId && ['nudge', 'council'].includes(attempt.kind))) throw new Error('Inspect the active or unknown primary task before polishing.');
  if ((idea.polishingRuns?.length ?? 0) >= 25 || workflowSerializedSize(idea.polishingRuns ?? []) > WORKFLOW_HISTORY_LIMIT_BYTES - 512 * 1024) throw new Error('The preserved polishing history has no space for another pass. Export its evidence first.');
  const target = selectPolishingTarget(idea); const primaryCheckpoint = polishingCheckpoint(idea);
  const sourceArtifacts = main && main.proposalRevision === workflowProposalRevision(idea) ? configuredInputs(main, { includePreviousResults: true }, idea.workflowHistory, idea) : [];
  if (target.sourceRunId && target.sourceArtifactId) {
    const owner = workflowRunOwner(idea, target.sourceRunId); const artifact = owner?.artifacts.find(item => item.id === target.sourceArtifactId);
    if (artifact && !sourceArtifacts.some(item => item.id === artifact.id)) sourceArtifacts.push(artifact);
  }
  const sourceHash = contextEventId(JSON.stringify([target.identity, target.contentHash, primaryCheckpoint?.contentHash ?? null]));
  const policySourceRevision = project.settings.workflow!.revision;
  const stopHold = state.workflowStopHolds?.includes(ideaId) ?? false;
  const oldExecutorAcknowledgementRequired = state.jobs.some(job => job.ideaId === ideaId && job.stage === 'implement' && job.provider !== 'demo');
  const identity = JSON.stringify({ target, primaryCheckpoint, configuration, feedback: text, sourceArtifacts, policySourceRevision, stopHold, paths: [project.projectPath, project.worktreeFolder, project.allowImplementation],
    projectContext: [project.settings.projectName, project.settings.projectBrief, project.settings.agentPrompt, project.settings.intervalSeconds] });
  return { idea, project, configuration, target, primaryCheckpoint, sourceArtifacts, sourceHash, policySourceRevision, stopHold, oldExecutorAcknowledgementRequired, feedback: text, identity };
}
