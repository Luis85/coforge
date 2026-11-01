import type { InternalState } from './ports';
import type { Idea } from '../domain/types';
import type { WorkflowArtifact, WorkflowRun } from '../domain/configured-workflow-run';
import { workflowProposalRevision } from '../domain/configured-workflow-run';
import { amendedPolishingTarget, polishingArtifactTarget, polishingResultArtifact, selectPolishingTarget } from '../domain/polishing-target';
import type { PolishingCodeBinding, PolishingRun } from '../domain/polishing';
import { polishingAmendmentsCheck } from '../domain/polishing-reference-check';
import { workflowRunHistoryHash } from '../domain/workflow-run-history-hash';
import { contextEventId } from '../domain/integrity-hash';
import { ideaFingerprint } from '../domain/integrity';
import { cleanText } from '../domain/sanitize';
import { heuristicSignals, isActiveJob } from '../domain/workflow';

export const polishingCodeOwner = (idea: Idea, pass: PolishingRun): string =>
  idea.workflowRun?.id ?? pass.target.workspaceOwnerRunId ?? pass.reviewedSource?.runId ?? pass.workflow.id;

/** Called inside the application's atomic command transaction after native copy verification. */
export function applyPolishingAmendment(state: InternalState, ideaId: string, polishingRunId: string, expectedRevision: number, binding?: PolishingCodeBinding): void {
  const idea = state.ideas.find(item => item.id === ideaId); const pass = idea?.polishingRuns?.find(item => item.id === polishingRunId);
  if (!idea || !pass || pass.review !== 'pending' || pass.workflow.revision !== expectedRevision) throw new Error('This polishing review changed. Reload its current result.');
  const target = selectPolishingTarget(idea); const checkpoint = pass.primaryCheckpoint; const primary = idea.workflowRun;
  if (target.identity !== pass.target.identity || target.contentHash !== pass.target.contentHash || target.proposalRevision !== pass.target.proposalRevision ||
      (checkpoint ? !primary || primary.id !== checkpoint.runId || primary.revision !== checkpoint.revision || primary.cursor !== checkpoint.cursor || primary.state !== checkpoint.state ||
        workflowRunHistoryHash(primary) !== checkpoint.contentHash : !!primary)) throw new Error('The original result or primary workflow changed. Review a new polishing pass.');
  if (state.jobs.some(job => job.ideaId === ideaId && (isActiveJob(job) || job.durable && !job.durable.acknowledged))) throw new Error('Wait for this request’s executor to settle before applying polishing.');
  const artifact = polishingResultArtifact(pass);
  if (target.kind === 'request') {
    const before = new Set(heuristicSignals(`${target.value.request!.title}\n${target.value.request!.description}`));
    if (heuristicSignals(cleanText(artifact.markdown!)).some(signal => !before.has(signal))) throw new Error('The polished request needs moderation review before it can replace the current input.');
  }
  if (artifact.screening?.verdict === 'clear' && idea.screening?.verdict === 'flagged') throw new Error('Resolve the existing moderation flag before applying a clear screening result.');
  if (binding && (target.kind !== 'codechange' || !artifact.increment || binding.ownerRunId !== polishingCodeOwner(idea, pass) ||
      binding.id !== pass.applyIntent?.id || binding.mode !== pass.applyIntent.mode || binding.ownerRunId !== pass.applyIntent.targetRunId ||
      pass.applyIntent.sourceArtifactId !== artifact.id || pass.applyIntent.sourceArtifactHash !== artifact.contentHash ||
      binding.workspaceEpoch !== pass.applyIntent.workspaceEpoch || binding.workspaceEpoch !== binding.id || binding.increment.simulated)) throw new Error('The reviewed resource binding does not match this code-polishing intent.');
  if (target.kind === 'codechange' && artifact.increment && !binding) throw new Error('Materialize the reviewed code result before applying it to this request.');
  const now = new Date().toISOString();
  const amendment = { id: contextEventId(`${pass.id}:${artifact.id}`), polishingRunId: pass.id, artifactId: artifact.id, artifactHash: artifact.contentHash,
    targetIdentity: target.identity, proposalRevision: target.proposalRevision, approvedAt: now, ...(binding ? { resourceBinding: binding } : {}) };
  idea.polishingAmendments = polishingAmendmentsCheck([...(idea.polishingAmendments ?? []), amendment]);
  pass.review = 'applied'; pass.reviewedAt = now;
  if (artifact.plan) idea.plan = structuredClone(artifact.plan);
  if (artifact.rice) idea.rice = structuredClone(artifact.rice);
  if (artifact.screening) idea.screening = structuredClone(artifact.screening);
  if (artifact.screening?.verdict === 'flagged') idea.status = 'flagged';
  if (binding) {
    idea.increment = structuredClone(binding.increment);
    if (primary) {
      primary.polishingResources = [...(primary.polishingResources ?? []), { id: binding.id, priorWorkspaceId: primary.workspaceId,
        priorAttemptCount: primary.attempts.length, workspaceId: binding.workspaceId, fromRunRevision: primary.revision }];
      primary.workspaceId = binding.workspaceId; primary.revision++; primary.updatedAt = now;
    }
  }
  if (target.kind === 'codechange') idea.status = pass.previousStatus === 'shipped' ? 'shipped' : 'review';
  idea.updatedAt = now; state.integrity[idea.id] = ideaFingerprint(idea);
}

/** A captured input projection; the canonical original proposal and historical artifacts stay intact. */
export function effectivePolishingIdea(idea: Idea): Idea {
  const effective = structuredClone(idea); const seen = new Set<string>();
  for (const amendment of idea.polishingAmendments ?? []) {
    if (seen.has(amendment.targetIdentity)) continue; seen.add(amendment.targetIdentity);
    const pass = idea.polishingRuns?.find(item => item.id === amendment.polishingRunId && item.review === 'applied');
    if (!pass || pass.target.kind !== 'request' || pass.target.proposalRevision !== workflowProposalRevision(idea)) continue;
    const target = amendedPolishingTarget(idea, pass.target);
    if (target.value.request) { effective.title = target.value.request.title; effective.description = target.value.request.description; }
  }
  return effective;
}
/** Substitute genuine approved auxiliary artifacts, preserving their actual IDs, run IDs and hashes. */
export function effectivePolishingInputs(idea: Idea, run: WorkflowRun, inputs: WorkflowArtifact[]): WorkflowArtifact[] {
  return inputs.map(input => {
    const current = amendedPolishingTarget(idea, polishingArtifactTarget(idea, run, input));
    if (!current.sourceArtifactId || current.sourceArtifactId === input.id) return input;
    const pass = idea.polishingRuns?.find(item => item.review === 'applied' && item.workflow.artifacts.some(artifact => artifact.id === current.sourceArtifactId));
    if (!pass) throw new Error('The approved current-result reference is missing.');
    return structuredClone(polishingResultArtifact(pass));
  });
}
