import { computed, reactive } from 'vue';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact } from '../../../features/coforge/domain/configured-workflow-run';
import type { Idea, Increment } from '../../../features/coforge/domain/types';
import { formatTime } from './format';

function incrementIdentity(increment: Increment): string {
  return workflowArtifactHash({ id: 'increment', runId: 'increment', stepId: 'increment', attemptId: 'increment', proposalRevision: 'increment', output: 'codechange', createdAt: increment.createdAt, increment });
}

/** Read-only projection of intact evidence bound to the displayed Build, never a quality verdict. */
export function incrementReviewEvidence(idea: Idea) {
  const run = idea.workflowRun;
  const empty = { criteria: [] as string[], followups: [] as { id: string; name: string; markdown: string; createdAt: string; savedLabel: string; assessmentLabel: string }[], hostCaptured: false };
  if (!run || !idea.increment || run.ideaId !== idea.id || run.projectId !== ideaProjectId(idea) || run.proposalRevision !== workflowProposalRevision(idea)) return empty;
  const invalidated = new Set(run.invalidatedArtifactIds);
  const artifacts: WorkflowArtifact[] = [];
  for (const candidate of run.artifacts) {
    if (invalidated.has(candidate.id) || candidate.runId !== run.id || candidate.proposalRevision !== run.proposalRevision) continue;
    try { artifacts.push(workflowArtifactCheck(candidate)); } catch { /* Historical/corrupt evidence stays in Workflow runs. */ }
  }
  const build = [...artifacts].reverse().find(item => item.output === 'codechange' && item.increment);
  if (!build?.increment || incrementIdentity(build.increment) !== incrementIdentity(idea.increment)) return empty;
  const buildAttempt = run.attempts.find(item => item.id === build.attemptId && item.stepId === build.stepId);
  const buildIndex = run.definition.steps.findIndex(step => step.id === build.stepId && step.kind === 'ai' && step.output === 'codechange');
  if (!buildAttempt || buildIndex < 0) return empty;
  const aliases = artifacts.filter(item => item.stepId === build.stepId && item.attemptId === build.attemptId && item.increment && incrementIdentity(item.increment) === incrementIdentity(idea.increment!));
  const aliasIds = new Set(aliases.map(item => item.id));
  const succeeded = (artifact: WorkflowArtifact) => {
    const attempt = [...run.attempts].reverse().find(item => item.stepId === artifact.stepId);
    return attempt?.id === artifact.attemptId && attempt.status === 'succeeded' ? attempt : undefined;
  };
  const plan = [...artifacts].reverse().find(item => item.output === 'plan' && item.plan && buildAttempt.inputs.includes(item.id) && succeeded(item));
  const seen = new Set<string>();
  const followups = [...artifacts].reverse().flatMap(artifact => {
    if (artifact.output !== 'markdown' || !artifact.markdown || seen.has(artifact.stepId)) return [];
    const attempt = succeeded(artifact);
    const index = run.definition.steps.findIndex(step => step.id === artifact.stepId && (step.kind === 'council' || step.kind === 'ai' && step.output === 'markdown'));
    if (!attempt || index <= buildIndex || index >= run.cursor || !attempt.inputs.some(id => aliasIds.has(id)) || Date.parse(artifact.createdAt) < Date.parse(build.createdAt)) return [];
    seen.add(artifact.stepId);
    const step = run.definition.steps[index];
    const assessmentLabel = step?.kind === 'council' ? 'Council assessment' : step?.kind === 'ai' && step.provider === 'demo' ? 'Simulated assessment' : 'Agent assessment';
    return [{ id: artifact.id, name: attempt.stepName, markdown: artifact.markdown, createdAt: artifact.createdAt, savedLabel: formatTime(artifact.createdAt), assessmentLabel }];
  }).reverse();
  return { criteria: plan?.plan?.acceptanceCriteria ?? [], followups, hostCaptured: aliases.some(item => item.hostSnapshot) };
}

export function useIncrementReview(props: { idea: Idea }) {
  return reactive({ evidence: computed(() => incrementReviewEvidence(props.idea)) });
}
