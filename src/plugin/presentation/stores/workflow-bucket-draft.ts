import type { WorkflowDefinition, WorkflowStep } from '../../features/coforge/domain/configured-workflow';
import type { WorkflowBucket } from '../../features/coforge/domain/workflow-buckets';

/** Mutations preserve complete steps; validation explains any newly broken dependency. */
export function addWorkflowBucket(definition: WorkflowDefinition): WorkflowBucket | undefined {
  const buckets = definition.buckets;
  if (!buckets || buckets.length >= 12) return;
  const bucket: WorkflowBucket = { id: crypto.randomUUID(), name: 'New bucket', description: '', role: 'process' };
  buckets.splice(buckets.length - 1, 0, bucket);
  return bucket;
}

export function moveWorkflowBucket(definition: WorkflowDefinition, id: string, direction: -1 | 1): boolean {
  const buckets = definition.buckets;
  if (!buckets) return false;
  const index = buckets.findIndex(bucket => bucket.id === id);
  const target = index + direction;
  if (buckets[index]?.role !== 'process' || buckets[target]?.role !== 'process') return false;
  const [bucket] = buckets.splice(index, 1);
  if (!bucket) return false;
  buckets.splice(target, 0, bucket);
  const assigned = new Set(buckets.map(item => item.id));
  definition.steps = [...buckets.flatMap(item => definition.steps.filter(step => step.bucketId === item.id)),
    ...definition.steps.filter(step => !step.bucketId || !assigned.has(step.bucketId))];
  return true;
}

export function removeWorkflowBucket(definition: WorkflowDefinition, id: string): boolean {
  const index = definition.buckets?.findIndex(bucket => bucket.id === id) ?? -1;
  if (definition.buckets?.[index]?.role !== 'process' || definition.steps.some(step => step.bucketId === id)) return false;
  definition.buckets.splice(index, 1);
  return true;
}

export function appendBucketStep(definition: WorkflowDefinition, step: WorkflowStep, bucketId: string): boolean {
  const bucketIndex = definition.buckets?.findIndex(bucket => bucket.id === bucketId) ?? -1;
  if (bucketIndex < 0 || definition.buckets?.[bucketIndex]?.role === 'accepted' || definition.steps.length >= 40) return false;
  const laterIds = new Set(definition.buckets?.slice(bucketIndex + 1).map(bucket => bucket.id));
  const next = definition.steps.findIndex(item => item.bucketId !== undefined && laterIds.has(item.bucketId));
  step.bucketId = bucketId;
  definition.steps.splice(next < 0 ? definition.steps.length : next, 0, step);
  return true;
}

export function assignWorkflowStepBucket(definition: WorkflowDefinition, id: string, bucketId: string): boolean {
  const bucket = definition.buckets?.find(item => item.id === bucketId);
  const index = definition.steps.findIndex(step => step.id === id);
  if (!bucket || bucket.role === 'accepted' || index < 0) return false;
  const [step] = definition.steps.splice(index, 1);
  if (!step) return false;
  return appendBucketStep(definition, step, bucketId);
}
