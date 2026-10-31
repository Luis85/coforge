import type { WorkflowDefinition } from './configured-workflow';
import { workflowArtifactCheck, workflowProposalRevision, type WorkflowRun } from './configured-workflow-run';
import { contextEventId } from './integrity';
import { ideaProjectId } from './projects';
import { materializeWorkflowBuckets, type WorkflowBucket } from './workflow-buckets';
import type { Idea } from './types';

export interface WorkflowBoardColumn {
  id: string; title: string; hint: string; icon: string; tone: string; canAdd: boolean; earlierWorkflow?: boolean; archived?: boolean; ideas: Idea[];
}

const appearance: Record<string, { icon: string; tone: string }> = {
  inbox: { icon: 'inbox', tone: 'inbox' }, next: { icon: 'sparkles', tone: 'next' },
  design: { icon: 'pencil-ruler', tone: 'design' }, progress: { icon: 'circle-dot', tone: 'progress' },
  done: { icon: 'check-check', tone: 'done' },
};
const legacyHints: Record<string, string> = {
  inbox: 'Listen & screen', next: 'Ranked for planning', design: 'Specification before Build',
  progress: 'Build & review', done: 'Community contributions',
};
function column(bucket: WorkflowBucket, id = bucket.id, earlierWorkflow = false, legacy = false): WorkflowBoardColumn {
  const knownStyle = Object.hasOwn(appearance, bucket.id) ? appearance[bucket.id] : undefined;
  const style = bucket.role === 'inbox' ? appearance.inbox! : bucket.role === 'accepted' ? appearance.done! : knownStyle ?? appearance.progress!;
  const hint = legacy ? legacyHints[bucket.id] ?? bucket.description : bucket.description;
  return { id, title: bucket.name, hint: earlierWorkflow ? `Earlier workflow${hint ? ` · ${hint}` : ''}` : hint,
    ...style, canAdd: bucket.role === 'inbox' && !earlierWorkflow, ...(earlierWorkflow ? { earlierWorkflow: true } : {}), ideas: [] };
}
function lifecycleBucket(idea: Idea): string {
  if (idea.status === 'shipped') return 'done';
  if (idea.status === 'ranked') return 'next';
  if (idea.status === 'planned') return 'design';
  if (idea.status === 'building' || idea.status === 'review') return 'progress';
  return 'inbox';
}
const retainedKey = (bucket: WorkflowBucket): string => `earlier:${contextEventId(JSON.stringify([bucket.id, bucket.name, bucket.role]))}`;
function currentCapturedRun(idea: Idea): WorkflowRun | undefined {
  const run = idea.workflowRun;
  return run?.definition.buckets && run.ideaId === idea.id && run.projectId === ideaProjectId(idea)
    && run.proposalRevision === workflowProposalRevision(idea) ? run : undefined;
}
function completedDesignBucket(run: WorkflowRun): WorkflowBucket | undefined {
  for (const artifact of [...run.artifacts].reverse()) {
    const producer = run.definition.steps.findIndex(step => step.id === artifact.stepId && step.kind === 'ai' && step.output === 'design');
    if (producer < 0 || producer >= run.cursor || artifact.output !== 'design' || artifact.runId !== run.id
      || artifact.proposalRevision !== run.proposalRevision || run.invalidatedArtifactIds?.includes(artifact.id)
      || !run.attempts.some(attempt => attempt.id === artifact.attemptId && attempt.stepId === artifact.stepId && attempt.status === 'succeeded')) continue;
    try {
      workflowArtifactCheck(artifact);
      return run.definition.buckets?.find(bucket => bucket.id === run.definition.steps[producer]?.bucketId && bucket.role !== 'accepted');
    } catch { /* Invalid saved evidence cannot claim Design completion. */ }
  }
}
/** A queued Build has not entered its bucket yet when current Design evidence is complete. */
function capturedBucket(run: WorkflowRun): WorkflowBucket | undefined {
  const index = Math.min(run.cursor, run.definition.steps.length - 1);
  const step = run.definition.steps[index];
  if (run.cursor < run.definition.steps.length && step?.kind === 'ai' && step.output === 'codechange'
    && !run.attempts.some(attempt => attempt.stepId === step.id && ['running', 'failed', 'succeeded', 'cancelled'].includes(attempt.status))) {
    const design = completedDesignBucket(run);
    if (design) return design;
  }
  return run.definition.buckets?.find(bucket => bucket.id === step?.bucketId && bucket.role !== 'accepted');
}

/** Private display metadata never changes canonical lifecycle status or grants execution authority. */
export function workflowBoardColumns(definition: WorkflowDefinition, ideas: readonly Idea[], holds: readonly string[] = []): WorkflowBoardColumn[] {
  const grouped = materializeWorkflowBuckets(definition);
  const current = grouped.buckets ?? [];
  const columns = current.map(bucket => column(bucket, bucket.id, false, !definition.buckets));
  const earlier = new Map<string, WorkflowBoardColumn>();
  const defaults = materializeWorkflowBuckets({ ...definition, buckets: undefined }).buckets ?? [];
  const capturedRuns = ideas.flatMap(idea => { const run = currentCapturedRun(idea); return run ? [run] : []; })
    .sort((a, b) => a.definition.revision.localeCompare(b.definition.revision) || a.id.localeCompare(b.id));
  const earlierOrder = [...new Set([...capturedRuns.flatMap(run => run.definition.buckets ?? []), ...defaults].map(retainedKey))];
  const endpoint = (role: WorkflowBucket['role']) => current.find(bucket => bucket.role === role)!;
  const locate = (bucket: WorkflowBucket, captured = false): WorkflowBoardColumn => {
    if (bucket.role !== 'process') return columns.find(item => item.id === endpoint(bucket.role).id)!;
    const match = current.find(item => item.id === bucket.id && item.role === bucket.role && (!captured || item.name === bucket.name));
    if (match) return columns.find(item => item.id === match.id)!;
    const key = retainedKey(bucket);
    let retained = earlier.get(key);
    if (!retained) { retained = column(bucket, key, true); earlier.set(key, retained); }
    return retained;
  };
  for (const idea of ideas) {
    if (idea.status === 'rejected') continue;
    let target: WorkflowBoardColumn;
    if (idea.status === 'shipped') target = locate(endpoint('accepted'));
    else if (holds.includes(idea.id) || idea.status === 'flagged' || idea.screening?.verdict === 'flagged' || idea.workflowRun?.state === 'stopped') target = locate(endpoint('inbox'));
    else {
      const run = currentCapturedRun(idea);
      const captured = run ? capturedBucket(run) : undefined;
      const fallbackId = lifecycleBucket(idea);
      const fallback = fallbackId === 'inbox' ? endpoint('inbox') : defaults.find(bucket => bucket.id === fallbackId)!;
      target = locate(captured ?? fallback, Boolean(captured));
    }
    target.ideas.push(idea);
  }
  const retained = [...earlier.values()].sort((a, b) => earlierOrder.indexOf(a.id) - earlierOrder.indexOf(b.id));
  columns.splice(Math.max(0, columns.length - 1), 0, ...retained);
  const archived = ideas.filter(idea => idea.status === 'rejected');
  if (archived.length) columns.push({ id: 'archive:rejected', archived: true, title: 'Archived', hint: 'Ideas kept for context', icon: 'inbox', tone: 'inbox', canAdd: false, ideas: archived });
  return columns;
}
