import { number, oneOf, optional, shape, text } from './check';
import { WORKFLOW_OUTPUTS, workflowIdCheck } from './configured-workflow';
import { workflowArtifactCheck, workflowIncrementCheck, workflowPlanCheck, workflowProposalRevision, workflowRiceCheck, workflowScreeningCheck, type WorkflowArtifact, type WorkflowRun } from './configured-workflow-run';
import { contextEventId } from './integrity-hash';
import { currentWorkspaceAttempt } from './workflow-execution-step';
import { cleanText } from './sanitize';
import type { PolishingRun, PolishingTarget, PolishingTargetKind } from './polishing';
import type { Idea } from './types';

const valueCheck = shape({ request: optional(shape({ title: text({ min: 1, max: 200 }), description: text({ max: 100000 }) }, { strict: true })),
  markdown: optional(text({ min: 1, max: 100000 })), screening: optional(workflowScreeningCheck), rice: optional(workflowRiceCheck),
  plan: optional(workflowPlanCheck), increment: optional(workflowIncrementCheck), summary: optional(text({ min: 1, max: 6000 })) }, { strict: true });
const targetCheck = shape({ kind: oneOf(['request', ...WORKFLOW_OUTPUTS] as const), identity: workflowIdCheck, contentHash: workflowIdCheck,
  proposalRevision: workflowIdCheck, sourceRunId: optional(workflowIdCheck), sourceRunRevision: optional(number({ integer: true, min: 0 })),
  sourceArtifactId: optional(workflowIdCheck), sourceJobId: optional(workflowIdCheck), sourceAttemptId: optional(workflowIdCheck),
  workspaceId: optional(workflowIdCheck), workspaceOwnerRunId: optional(workflowIdCheck), sourceMaterializationId: optional(workflowIdCheck), value: valueCheck }, { strict: true });

export const polishingValueHash = (kind: PolishingTargetKind, value: PolishingTarget['value']): string => contextEventId(JSON.stringify([kind, valueCheck(value)]));
export function polishingTargetCheck(value: unknown): PolishingTarget {
  const target = targetCheck(value); const key = target.kind === 'design' ? 'markdown' : target.kind === 'codechange' ? 'increment' : target.kind;
  const fields = ['request', 'markdown', 'screening', 'rice', 'plan', 'increment', 'summary'] as const;
  if (fields.some(field => field !== key && !(field === 'summary' && target.kind === 'codechange') && target.value[field] !== undefined) ||
      (target.kind === 'codechange' ? !target.value.increment && !target.value.summary : target.value[key] === undefined) ||
      target.contentHash !== polishingValueHash(target.kind, target.value)) throw new Error('The polishing target payload or captured content hash changed.');
  return target;
}
function captured(idea: Idea, kind: PolishingTargetKind, value: PolishingTarget['value'], source: Partial<PolishingTarget> = {}, anchor?: string): PolishingTarget {
  return polishingTargetCheck({ kind, value: structuredClone(value), identity: contextEventId(JSON.stringify([idea.id, kind, kind === 'codechange' ? 'code' : anchor ?? 'legacy'])),
    proposalRevision: workflowProposalRevision(idea), contentHash: polishingValueHash(kind, value), ...source });
}
export function polishingArtifactTarget(idea: Idea, run: WorkflowRun, artifact: WorkflowArtifact): PolishingTarget {
  const valid = workflowArtifactCheck(artifact); const attempt = run.attempts.find(item => item.id === valid.attemptId);
  if (valid.runId !== run.id || valid.proposalRevision !== run.proposalRevision || !attempt || attempt.stepId !== valid.stepId || run.invalidatedArtifactIds?.includes(valid.id))
    throw new Error('The original result is no longer a valid workflow artifact.');
  const value: PolishingTarget['value'] = {};
  if (valid.output === 'codechange') { if (valid.increment) value.increment = valid.increment; value.summary = valid.increment?.summary ?? valid.summary; }
  else if (valid.output === 'markdown' || valid.output === 'design') value.markdown = valid.markdown;
  else if (valid.output === 'screening') value.screening = valid.screening;
  else if (valid.output === 'rice') value.rice = valid.rice;
  else value.plan = valid.plan;
  return captured(idea, valid.output, value, { sourceRunId: run.id, sourceRunRevision: run.revision, sourceArtifactId: valid.id,
    sourceAttemptId: attempt.id, ...(attempt.jobId ? { sourceJobId: attempt.jobId } : {}), ...(valid.output === 'codechange' && run.workspaceId ? { workspaceId: run.workspaceId } : {}) }, valid.id);
}
/** Genuine completed auxiliary output. It retains its own run, attempt and content hash. */
export function polishingResultArtifact(pass: PolishingRun): WorkflowArtifact {
  const run = pass.workflow;
  if (!['finished', 'awaiting-review'].includes(run.state) || run.cursor !== 1 || run.activeAttemptId) throw new Error('Finish the polishing pass before reviewing its result.');
  const attempt = [...run.attempts].reverse().find(item => item.status === 'succeeded');
  const artifact = [...run.artifacts].reverse().find(item => item.attemptId === attempt?.id && !item.hostSnapshot && !run.invalidatedArtifactIds?.includes(item.id));
  if (!attempt || !artifact || artifact.output !== (pass.target.kind === 'request' ? 'markdown' : pass.target.kind) || artifact.runId !== run.id || artifact.proposalRevision !== run.proposalRevision)
    throw new Error('The completed polishing output is missing or changed.');
  return workflowArtifactCheck(artifact);
}
/** Review projection from the genuine output; it does not make pending output current. */
export function polishingResultValue(pass: PolishingRun): PolishingTarget['value'] {
  const artifact = polishingResultArtifact(pass);
  if (pass.target.kind === 'request') return { request: { title: pass.target.value.request!.title, description: cleanText(artifact.markdown!, 100000) } };
  if (pass.target.kind === 'codechange') return { ...(artifact.increment ? { increment: artifact.increment } : {}), summary: artifact.increment?.summary ?? artifact.summary };
  if (pass.target.kind === 'markdown' || pass.target.kind === 'design') return { markdown: artifact.markdown };
  if (pass.target.kind === 'screening') return { screening: artifact.screening };
  if (pass.target.kind === 'rice') return { rice: artifact.rice };
  return { plan: artifact.plan };
}
function baseTarget(idea: Idea): PolishingTarget {
  const run = idea.workflowRun; const current = run?.proposalRevision === workflowProposalRevision(idea) ? run : undefined;
  if (idea.increment) {
    const currentHash = polishingValueHash('codechange', { increment: idea.increment, summary: idea.increment.summary });
    const amendment = [...(idea.polishingAmendments ?? [])].reverse().find(item => item.resourceBinding &&
      polishingValueHash('codechange', { increment: item.resourceBinding.increment, summary: item.resourceBinding.increment.summary }) === currentHash);
    const binding = amendment?.resourceBinding;
    if (binding && amendment) {
      const producer = idea.polishingRuns?.find(pass => pass.id === amendment.polishingRunId && pass.review === 'applied');
      const artifact = producer && polishingResultArtifact(producer);
      if (!producer || artifact?.id !== amendment.artifactId || artifact.contentHash !== amendment.artifactHash) throw new Error('The approved code result provenance changed.');
      return captured(idea, 'codechange', { increment: idea.increment, summary: idea.increment.summary }, { workspaceId: binding.workspaceId,
        workspaceOwnerRunId: binding.ownerRunId, sourceMaterializationId: binding.id, sourceArtifactId: artifact.id, sourceRunId: producer.id, sourceRunRevision: producer.workflow.revision });
    }
    const materialization = [...(current?.polishingResources ?? [])].reverse().find(item => item.workspaceId === current?.workspaceId);
    const source = current && [...current.artifacts].reverse().find(item => item.output === 'codechange' && item.increment && currentWorkspaceAttempt(current, item.attemptId) &&
      !current.invalidatedArtifactIds?.includes(item.id) && polishingValueHash('codechange', { increment: item.increment, summary: item.increment.summary }) === currentHash);
    return captured(idea, 'codechange', { increment: idea.increment, summary: idea.increment.summary },
      { ...(current ? { sourceRunId: current.id, sourceRunRevision: current.revision, workspaceId: current.workspaceId } : {}),
        ...(materialization && current ? { workspaceOwnerRunId: current.id, sourceMaterializationId: materialization.id } : {}),
        ...(source ? { sourceArtifactId: source.id, ...(!materialization ? { sourceAttemptId: source.attemptId, sourceJobId: current?.attempts.find(item => item.id === source.attemptId)?.jobId } : {}) } : {}) });
  }
  if (current) {
    const artifact = [...current.artifacts].reverse().find(item => !current.invalidatedArtifactIds?.includes(item.id) && item.proposalRevision === current.proposalRevision &&
      (item.output !== 'codechange' || currentWorkspaceAttempt(current, item.attemptId)) && current.definition.steps.findIndex(step => step.id === item.stepId) <= current.cursor &&
      current.attempts.some(attempt => attempt.id === item.attemptId && (attempt.status === 'succeeded' || item.hostSnapshot && item.increment)));
    if (artifact) return polishingArtifactTarget(idea, current, artifact);
  }
  if (idea.plan) return captured(idea, 'plan', { plan: idea.plan });
  if (idea.rice) return captured(idea, 'rice', { rice: idea.rice });
  if (idea.screening) return captured(idea, 'screening', { screening: idea.screening });
  return captured(idea, 'request', { request: { title: idea.title, description: idea.description } });
}
/** Resolve only approved references whose source still matches the preceding version. Pending output is never current. */
export function amendedPolishingTarget(idea: Idea, original: PolishingTarget): PolishingTarget {
  let target = original;
  const typedValue = original.kind === 'screening' && idea.screening ? { screening: idea.screening } : original.kind === 'rice' && idea.rice ? { rice: idea.rice } : original.kind === 'plan' && idea.plan ? { plan: idea.plan } : undefined;
  const typedHash = typedValue ? polishingValueHash(original.kind, typedValue) : undefined;
  for (const amendment of idea.polishingAmendments ?? []) {
    if (amendment.targetIdentity !== target.identity || amendment.proposalRevision !== target.proposalRevision) continue;
    const pass = idea.polishingRuns?.find(item => item.id === amendment.polishingRunId && item.review === 'applied');
    if (!pass || pass.target.identity !== target.identity) continue;
    const artifact = polishingResultArtifact(pass);
    if (artifact.id !== amendment.artifactId || artifact.contentHash !== amendment.artifactHash) throw new Error('An approved polishing reference changed.');
    const increment = amendment.resourceBinding?.increment ?? artifact.increment ?? target.value.increment;
    const value: PolishingTarget['value'] = target.kind === 'request' ? { request: { title: target.value.request!.title, description: cleanText(artifact.markdown!, 100000) } } :
      target.kind === 'codechange' ? { ...(increment ? { increment } : {}), summary: increment?.summary ?? artifact.summary } :
        target.kind === 'design' || target.kind === 'markdown' ? { markdown: artifact.markdown } : target.kind === 'screening' ? { screening: artifact.screening } :
          target.kind === 'rice' ? { rice: artifact.rice } : { plan: artifact.plan };
    const contentHash = polishingValueHash(target.kind, value);
    if (pass.target.contentHash !== target.contentHash && contentHash !== typedHash) continue;
    const producingAttempt = pass.workflow.attempts.find(item => item.id === artifact.attemptId);
    target = polishingTargetCheck({ ...target, value, contentHash, sourceArtifactId: artifact.id,
      ...(target.kind === 'codechange' ? {} : { sourceRunId: pass.workflow.id, sourceRunRevision: pass.workflow.revision,
        sourceAttemptId: artifact.attemptId, sourceJobId: producingAttempt?.jobId }),
      ...(amendment.resourceBinding ? { workspaceId: amendment.resourceBinding.workspaceId, workspaceOwnerRunId: amendment.resourceBinding.ownerRunId, sourceMaterializationId: amendment.resourceBinding.id } : {}) });
  }
  // Explicit human compatibility edits (for example unflagging) supersede an older approved AI result.
  if (typedValue && typedHash !== target.contentHash) return { ...captured(idea, original.kind, typedValue), identity: original.identity };
  return target;
}
export function selectPolishingTarget(idea: Idea): PolishingTarget { return amendedPolishingTarget(idea, baseTarget(idea)); }
