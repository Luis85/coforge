import { expect, it } from 'vitest';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { defaultWorkflowDefinition, workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { materializeWorkflowBuckets } from '../../../features/coforge/domain/workflow-buckets';
import { addWorkflowBucket, appendBucketStep, assignWorkflowStepBucket, moveWorkflowBucket, removeWorkflowBucket } from '../../../presentation/stores/workflow-bucket-draft';
import { duplicateWorkflowStep, moveWorkflowStep } from '../../../presentation/stores/workflow-editor-draft';

it('moves complete bucket segments and retains invalid dependencies for explicit repair', () => {
  const draft = materializeWorkflowBuckets(defaultWorkflowDefinition(defaultSettings()));
  const design = draft.steps.find(step => step.id === 'design')!;
  const before = structuredClone(design);
  expect(moveWorkflowBucket(draft, design.bucketId!, -1)).toBe(true);
  expect(draft.steps.find(step => step.id === 'design')).toEqual(before);
  expect(() => workflowDefinitionCheck(draft)).toThrow(/preceding producer/);
  expect(moveWorkflowBucket(draft, draft.buckets![0]!.id, 1)).toBe(false);
  expect(moveWorkflowBucket(draft, draft.buckets!.at(-1)!.id, -1)).toBe(false);
});

it('adds, removes and bounds intermediate buckets without dropping their work', () => {
  const draft = materializeWorkflowBuckets(defaultWorkflowDefinition(defaultSettings()));
  const bucket = addWorkflowBucket(draft)!;
  expect(draft.buckets!.at(-2)).toBe(bucket);
  expect(appendBucketStep(draft, { id: 'manual', name: 'Review', instructions: 'Inspect', kind: 'approval' }, bucket.id)).toBe(true);
  expect(removeWorkflowBucket(draft, bucket.id)).toBe(false);
  const inbox = draft.buckets![0]!;
  expect(assignWorkflowStepBucket(draft, 'manual', inbox.id)).toBe(true);
  expect(removeWorkflowBucket(draft, bucket.id)).toBe(true);
  expect(draft.steps.find(step => step.id === 'manual')?.bucketId).toBe(inbox.id);
  expect(removeWorkflowBucket(draft, inbox.id)).toBe(false);
  while (draft.buckets!.length < 12) expect(addWorkflowBucket(draft)).toBeDefined();
  expect(addWorkflowBucket(draft)).toBeUndefined();
});

it('moves steps only within their bucket and duplicates complete data into the same bucket', () => {
  const draft = materializeWorkflowBuckets(defaultWorkflowDefinition(defaultSettings()));
  const screen = draft.steps[0]!;
  moveWorkflowStep(draft, screen.id, -1);
  moveWorkflowStep(draft, screen.id, 1);
  expect(draft.steps[1]?.id).toBe(screen.id);
  const order = draft.steps.map(step => step.id);
  moveWorkflowStep(draft, screen.id, 1);
  expect(draft.steps.map(step => step.id)).toEqual(order);
  const copy = duplicateWorkflowStep(draft, screen.id)!;
  expect(copy.bucketId).toBe(screen.bucketId);
  expect(copy.instructions).toBe(screen.instructions);
  expect(assignWorkflowStepBucket(draft, copy.id, draft.buckets!.at(-1)!.id)).toBe(false);
  const target = draft.buckets![2]!;
  expect(assignWorkflowStepBucket(draft, copy.id, target.id)).toBe(true);
  expect(draft.steps.filter(step => step.bucketId === target.id).at(-1)?.id).toBe(copy.id);
});
