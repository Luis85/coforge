import { CheckError, oneOf, shape, text } from './check';
import type { WorkflowDefinition, WorkflowStep } from './configured-workflow';

export interface WorkflowBucket {
  id: string;
  name: string;
  description: string;
  role: 'inbox' | 'process' | 'accepted';
}

export const workflowBucketCheck = shape({
  id: text({ min: 1, max: 80, pattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u }),
  name: text({ trim: true, min: 1, max: 100 }),
  description: text({ max: 1000 }),
  role: oneOf(['inbox', 'process', 'accepted'] as const),
}, { strict: true });

/** Buckets organize one flat executable sequence; the final outcome never executes work. */
export function validateWorkflowBuckets(definition: Pick<WorkflowDefinition, 'buckets' | 'steps'>): void {
  const { buckets, steps } = definition;
  if (!buckets) {
    if (steps.some(step => step.bucketId !== undefined)) throw new CheckError('buckets', 'Step bucket assignments require workflow buckets.');
    return;
  }
  if (new Set(buckets.map(bucket => bucket.id)).size !== buckets.length) throw new CheckError('buckets', 'Workflow bucket IDs must be unique.');
  if (buckets[0]?.role !== 'inbox' || buckets.filter(bucket => bucket.role === 'inbox').length !== 1)
    throw new CheckError('buckets', 'Exactly one Inbox bucket must be first.');
  if (buckets.at(-1)?.role !== 'accepted' || buckets.filter(bucket => bucket.role === 'accepted').length !== 1)
    throw new CheckError('buckets', 'Exactly one Accepted bucket must be last.');
  let previous = 0;
  for (const [index, step] of steps.entries()) {
    const position = buckets.findIndex(bucket => bucket.id === step.bucketId);
    if (position < 0) throw new CheckError(`steps[${index}].bucketId`, 'Choose an existing workflow bucket for every step.');
    if (buckets[position]?.role === 'accepted') throw new CheckError(`steps[${index}].bucketId`, 'Accepted is an outcome; move executable steps to an earlier bucket.');
    if (position < previous) throw new CheckError(`steps[${index}].bucketId`, 'Step order must follow bucket order.');
    previous = position;
  }
}

const standardBuckets: readonly WorkflowBucket[] = [
  { id: 'inbox', name: 'Inbox', description: 'Listen, screen and score incoming requests.', role: 'inbox' },
  { id: 'next', name: 'Up next', description: 'Prioritize and plan the next work.', role: 'process' },
  { id: 'design', name: 'Design', description: 'Prepare a specification before Build.', role: 'process' },
  { id: 'progress', name: 'In progress', description: 'Build and review changes.', role: 'process' },
  { id: 'done', name: 'Accepted', description: 'Changes accepted by the streamer.', role: 'accepted' },
];

function semanticBucketPosition(step: WorkflowStep): number | undefined {
  if (step.kind !== 'ai') return undefined;
  if (step.access === 'editworktree' || step.output === 'codechange') return 3;
  if (step.output === 'design') return 2;
  if (step.output === 'plan') return 1;
  if (step.output === 'screening' || step.output === 'rice') return 0;
  return undefined;
}

/** Explicit editor adoption only: legacy notes and captured definitions are never normalized. */
export function materializeWorkflowBuckets(definition: WorkflowDefinition): WorkflowDefinition {
  const draft = structuredClone(definition);
  if (draft.buckets !== undefined) return draft;
  draft.buckets = standardBuckets.map(bucket => ({ ...bucket }));
  let position = 0;
  for (const step of draft.steps) {
    position = Math.max(position, semanticBucketPosition(step) ?? position);
    step.bucketId = standardBuckets[position]!.id;
  }
  return draft;
}
