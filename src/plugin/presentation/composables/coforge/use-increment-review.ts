import { computed, reactive } from 'vue';
import { ideaProjectId } from '../../../features/coforge/domain/projects';
import { workflowArtifactCheck, workflowArtifactHash, workflowProposalRevision, type WorkflowArtifact, type WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import type { AgentJob, Idea, Increment } from '../../../features/coforge/domain/types';
import { formatTime } from './format';
import { polishingResultArtifact } from '../../../features/coforge/domain/polishing-target';
import type { PolishingCodeBinding, PolishingRun } from '../../../features/coforge/domain/polishing';
import { ideaWorkflowRun } from './idea-workflow-run';
import type { WorkflowVerificationRecord } from '../../../features/coforge/domain/workflow-verification';
import { postBuildVerification, type PostBuildVerification } from './increment-review-verification';
import { useStudioStore } from '../../stores/coforge-studio';

interface IncrementReviewEvidence {
  producingAttempt?: { runId: string; attemptId: string; historical: boolean };
  postBuildChecks: PostBuildVerification[];
  verification?: WorkflowVerificationRecord[];
  historicalVerification?: boolean;
  criteria: string[];
  followups: { id: string; name: string; markdown: string; createdAt: string; savedLabel: string; assessmentLabel: string }[];
  hostCaptured: boolean;
  polishing?: { runId: string; artifactId: string; ownerRunId: string; workspaceId: string };
}

function incrementIdentity(increment: Increment): string {
  return workflowArtifactHash({ id: 'increment', runId: 'increment', stepId: 'increment', attemptId: 'increment', proposalRevision: 'increment', output: 'codechange', createdAt: increment.createdAt, increment });
}

function sameCapturedBytes(left: Increment, right: Increment): boolean {
  return !left.simulated && !right.simulated && left.diff === right.diff && JSON.stringify(left.files) === JSON.stringify(right.files)
    && (!left.snapshotHash || left.snapshotHash === right.snapshotHash);
}

function validPolishingBinding(idea: Idea, pass: PolishingRun, binding: PolishingCodeBinding, build: WorkflowArtifact): boolean {
  const intent = pass.applyIntent;
  const ownerId = idea.workflowRun?.id ?? pass.target.workspaceOwnerRunId ?? pass.reviewedSource?.runId ?? pass.workflow.id;
  const owner = ideaWorkflowRun(idea, binding.ownerRunId);
  if (!intent || binding.id !== intent.id || binding.workspaceEpoch !== binding.id || binding.workspaceEpoch !== intent.workspaceEpoch
    || binding.mode !== intent.mode || binding.ownerRunId !== intent.targetRunId || binding.ownerRunId !== ownerId
    || intent.sourceArtifactId !== build.id || intent.sourceArtifactHash !== build.contentHash
    || intent.primaryCheckpointHash !== (pass.primaryCheckpoint?.contentHash ?? 'none')
    || !pass.reviewedSnapshot || intent.baseline.id !== pass.reviewedSnapshot.id || intent.baseline.contentHash !== pass.reviewedSnapshot.contentHash
    || !owner || owner.ideaId !== idea.id || owner.projectId !== ideaProjectId(idea) || owner.proposalRevision !== workflowProposalRevision(idea)) return false;
  const primary = idea.workflowRun;
  if (primary && (primary.workspaceId !== binding.workspaceId || pass.primaryCheckpoint?.runId !== primary.id
    || !primary.polishingResources?.some(epoch => epoch.id === binding.id && epoch.workspaceId === binding.workspaceId
      && epoch.fromRunRevision === pass.primaryCheckpoint?.revision))) return false;
  if (!primary && pass.primaryCheckpoint) return false;
  if (!build.increment || build.increment.simulated || !sameCapturedBytes(build.increment, binding.increment)) return false;
  return pass.workflow.artifacts.some(candidate => {
    if (!candidate.hostSnapshot || candidate.id === build.id || candidate.runId !== pass.workflow.id || candidate.attemptId !== build.attemptId
      || candidate.stepId !== build.stepId || candidate.proposalRevision !== pass.workflow.proposalRevision || pass.workflow.invalidatedArtifactIds?.includes(candidate.id)) return false;
    try {
      const host = workflowArtifactCheck(candidate);
      return !!host.increment && !host.increment.simulated && incrementIdentity(host.increment) === incrementIdentity(build.increment!);
    } catch { return false; }
  });
}

function capturedPlanCriteria(idea: Idea, pass: PolishingRun, inputs: string[]): string[] {
  for (const candidate of [...pass.sourceArtifacts].reverse()) {
    if (candidate.output !== 'plan' || candidate.proposalRevision !== pass.workflow.proposalRevision || !inputs.includes(candidate.id)) continue;
    const owner = ideaWorkflowRun(idea, candidate.runId);
    if (!owner || owner.ideaId !== idea.id || owner.projectId !== ideaProjectId(idea) || owner.proposalRevision !== candidate.proposalRevision
      || !owner.artifacts.some(source => source.id === candidate.id && source.contentHash === candidate.contentHash)
      || !owner.attempts.some(attempt => attempt.id === candidate.attemptId && attempt.stepId === candidate.stepId && attempt.status === 'succeeded')) continue;
    try { const plan = workflowArtifactCheck(candidate); if (plan.plan) return plan.plan.acceptanceCriteria; } catch { /* Corrupt context cannot supply criteria. */ }
  }
  return [];
}

/** A read-only transport can recapture the same tree; it cannot become the editing producer. */
function buildScopedAliases(run: WorkflowRun, artifacts: WorkflowArtifact[], build: WorkflowArtifact, buildIndex: number): WorkflowArtifact[] {
  if (!build.increment) return [];
  const original = build.increment;
  const aliases = artifacts.filter(item => item.stepId === build.stepId && item.attemptId === build.attemptId && item.increment
    && incrementIdentity(item.increment) === incrementIdentity(original));
  if (!original.snapshotHash || !original.worktree || !original.branch || !aliases.some(item => item.hostSnapshot)) return aliases;
  const ids = new Set(aliases.map(item => item.id));
  for (const candidate of artifacts) {
    if (!candidate.hostSnapshot || !candidate.increment || ids.has(candidate.id) || !sameCapturedBytes(original, candidate.increment)
      || candidate.increment.worktree !== original.worktree || candidate.increment.branch !== original.branch || Date.parse(candidate.createdAt) < Date.parse(build.createdAt)) continue;
    const index = run.definition.steps.findIndex(step => step.id === candidate.stepId && step.kind === 'ai' && step.access === 'readproject');
    const attempt = [...run.attempts].reverse().find(item => item.stepId === candidate.stepId);
    if (index <= buildIndex || !attempt || attempt.id !== candidate.attemptId || attempt.status !== 'succeeded' || !attempt.inputs.some(id => ids.has(id))) continue;
    aliases.push(candidate); ids.add(candidate.id);
  }
  return aliases;
}

/** Approved materialization proves the displayed bytes; its producer remains the genuine auxiliary run. */
function approvedPolishingEvidence(idea: Idea): IncrementReviewEvidence | undefined {
  if (!idea.increment || idea.increment.simulated) return;
  const proposalRevision = workflowProposalRevision(idea);
  for (const amendment of [...(idea.polishingAmendments ?? [])].reverse()) {
    const binding = amendment.resourceBinding;
    if (!binding || binding.increment.simulated || amendment.proposalRevision !== proposalRevision
      || incrementIdentity(binding.increment) !== incrementIdentity(idea.increment)) continue;
    const pass = idea.polishingRuns?.find(item => item.id === amendment.polishingRunId && item.review === 'applied' && item.target.kind === 'codechange');
    if (!pass || pass.workflow.id !== pass.id || pass.workflow.ideaId !== idea.id || pass.workflow.projectId !== ideaProjectId(idea)
      || pass.workflow.proposalRevision !== proposalRevision || pass.target.proposalRevision !== proposalRevision || amendment.targetIdentity !== pass.target.identity) continue;
    let build: WorkflowArtifact;
    try { build = polishingResultArtifact(pass); } catch { continue; }
    if (build.id !== amendment.artifactId || build.contentHash !== amendment.artifactHash || !validPolishingBinding(idea, pass, binding, build)) continue;
    const attempt = pass.workflow.attempts.find(item => item.id === build.attemptId && item.stepId === build.stepId && item.status === 'succeeded');
    if (!attempt) continue;
    const criteria = capturedPlanCriteria(idea, pass, attempt.inputs);
    return { criteria, followups: [], postBuildChecks: [], hostCaptured: true, verification: build.increment?.verification ?? [], historicalVerification: true,
      producingAttempt: { runId: pass.workflow.id, attemptId: build.attemptId, historical: true },
      polishing: { runId: pass.id, artifactId: build.id, ownerRunId: binding.ownerRunId, workspaceId: binding.workspaceId } };
  }
}

/** Read-only projection of intact evidence bound to the displayed Build, never a quality verdict. */
export function incrementReviewEvidence(idea: Idea, jobs: readonly AgentJob[] = []): IncrementReviewEvidence {
  const polished = approvedPolishingEvidence(idea);
  if (polished) return polished;
  const run = idea.workflowRun;
  const empty: IncrementReviewEvidence = { criteria: [], followups: [], postBuildChecks: [], hostCaptured: false };
  if (!run || !idea.increment || run.ideaId !== idea.id || run.projectId !== ideaProjectId(idea) || run.proposalRevision !== workflowProposalRevision(idea)) return empty;
  const invalidated = new Set(run.invalidatedArtifactIds);
  const artifacts: WorkflowArtifact[] = [];
  for (const candidate of run.artifacts) {
    if (invalidated.has(candidate.id) || candidate.runId !== run.id || candidate.proposalRevision !== run.proposalRevision) continue;
    try { artifacts.push(workflowArtifactCheck(candidate)); } catch { /* Historical/corrupt evidence stays in Workflow runs. */ }
  }
  const build = [...artifacts].reverse().find(item => item.output === 'codechange' && item.increment
    && run.definition.steps.some(step => step.id === item.stepId && step.kind === 'ai' && step.output === 'codechange' && step.access === 'editworktree'));
  if (!build?.increment) return empty;
  const buildAttempt = run.attempts.find(item => item.id === build.attemptId && item.stepId === build.stepId);
  const buildIndex = run.definition.steps.findIndex(step => step.id === build.stepId && step.kind === 'ai' && step.output === 'codechange');
  if (!buildAttempt || buildIndex < 0) return empty;
  const aliases = buildScopedAliases(run, artifacts, build, buildIndex);
  if (!aliases.some(item => item.increment && incrementIdentity(item.increment) === incrementIdentity(idea.increment!))) return empty;
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
  return { criteria: plan?.plan?.acceptanceCriteria ?? [], followups, hostCaptured: aliases.some(item => item.hostSnapshot),
    producingAttempt: { runId: run.id, attemptId: build.attemptId, historical: false },
    postBuildChecks: postBuildVerification(idea, jobs, run, build, buildIndex, artifacts) };
}

export function useIncrementReview(props: { idea: Idea }) {
  const store = useStudioStore();
  const evidence = computed(() => incrementReviewEvidence(props.idea, store.state?.jobs ?? []));
  return reactive({ evidence, verificationNotes: computed(() => (props.idea.increment?.tests ?? []).filter(note => !evidence.value.postBuildChecks.length || !note.startsWith('Not run: shell tools are disabled.'))) });
}
