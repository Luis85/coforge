import { describe, expect, it } from 'vitest';
import { defaultWorkflowDefinition, parseWorkflowDefinition, serializeWorkflowDefinition, workflowDefinitionCheck } from '../../../features/coforge/domain/configured-workflow';
import { materializeWorkflowBuckets } from '../../../features/coforge/domain/workflow-buckets';
import { defaultSettings } from '../../../features/coforge/domain/seed';
import { ai, definition } from './configured-workflow-fixture';

const grouped = () => materializeWorkflowBuckets(defaultWorkflowDefinition(defaultSettings()));

describe('bucket workflow definitions', () => {
  it('materializes only an independent draft with standard grouping and unchanged execution', () => {
    const legacy = defaultWorkflowDefinition(defaultSettings());
    const before = JSON.stringify(legacy);
    const draft = materializeWorkflowBuckets(legacy);
    expect(draft.buckets?.map(bucket => [bucket.id, bucket.role])).toEqual([
      ['inbox', 'inbox'], ['next', 'process'], ['design', 'process'], ['progress', 'process'], ['done', 'accepted'],
    ]);
    expect(draft.steps.map(step => step.bucketId)).toEqual(['inbox', 'inbox', 'next', 'design', 'progress']);
    expect(draft.steps.map(({ bucketId: _bucketId, ...step }) => step)).toEqual(legacy.steps);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(serializeWorkflowDefinition(parseWorkflowDefinition(before))).toBe(JSON.stringify(legacy, null, 2));
    expect(legacy).not.toHaveProperty('buckets');
    expect(defaultWorkflowDefinition(defaultSettings())).toEqual(legacy);
    draft.steps[0]!.instructions = 'Changed draft';
    draft.buckets![0]!.name = 'Changed label';
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('groups arbitrary legacy orders monotonically without changing identity, dependencies or payloads', () => {
    const legacy = definition([
      { id: 'first', kind: 'approval', name: 'Start', instructions: 'Human start' },
      ai('spec', 'design', 'readproject'),
      { id: 'human', kind: 'checklist', name: 'Inspect', instructions: 'Inspect results', items: [{ id: 'check', label: 'Ready', required: true }] },
      ai('later-plan', 'plan'), ai('late-screen', 'screening'), ai('edit', 'markdown', 'editworktree'),
    ]);
    const draft = materializeWorkflowBuckets(legacy);
    expect(draft.steps.map(step => step.id)).toEqual(legacy.steps.map(step => step.id));
    expect(draft.steps.map(step => step.bucketId)).toEqual(['inbox', 'design', 'design', 'design', 'design', 'progress']);
    expect(workflowDefinitionCheck(draft)).toEqual(draft);
    expect(draft.steps.map(({ bucketId: _bucketId, ...step }) => step)).toEqual(legacy.steps);
  });

  it('retains authored bucket IDs, labels, descriptions, order and assignments exactly', () => {
    const draft = grouped();
    draft.buckets![1]!.name = 'Explore';
    draft.buckets![1]!.description = 'Keep {{format}} and [[context]]\r\nexactly.';
    draft.buckets![1]!.id = 'discovery';
    draft.steps[2]!.bucketId = 'discovery';
    const copy = materializeWorkflowBuckets(draft);
    expect(copy).toEqual(draft);
    expect(parseWorkflowDefinition(serializeWorkflowDefinition(draft))).toEqual(draft);
    copy.buckets![1]!.name = 'Independent';
    expect(draft.buckets![1]!.name).toBe('Explore');
  });

  it('requires unique bounded buckets and exactly one ordered Inbox and Accepted endpoint', () => {
    const draft = grouped();
    expect(() => workflowDefinitionCheck({ ...draft, buckets: [] })).toThrow();
    expect(() => workflowDefinitionCheck({ ...draft, buckets: [draft.buckets![0]] })).toThrow();
    expect(() => workflowDefinitionCheck({ ...draft, buckets: Array.from({ length: 13 }, (_, index) => ({ id: `bucket-${index}`, name: 'Bucket', description: '', role: index === 0 ? 'inbox' : index === 12 ? 'accepted' : 'process' })) })).toThrow();
    const duplicate = structuredClone(draft);
    duplicate.buckets![1]!.id = duplicate.buckets![0]!.id;
    expect(() => workflowDefinitionCheck(duplicate)).toThrow('unique');
    const misplaced = structuredClone(draft);
    misplaced.buckets!.reverse();
    expect(() => workflowDefinitionCheck(misplaced)).toThrow('Inbox');
    const extraEndpoint = structuredClone(draft);
    extraEndpoint.buckets![1]!.role = 'inbox';
    expect(() => workflowDefinitionCheck(extraEndpoint)).toThrow('Inbox');
    const noAccepted = structuredClone(draft);
    noAccepted.buckets!.at(-1)!.role = 'process';
    expect(() => workflowDefinitionCheck(noAccepted)).toThrow('Accepted');
    expect(() => workflowDefinitionCheck({ ...draft, buckets: draft.buckets!.map(bucket => ({ ...bucket, allowShell: true })) })).toThrow();
  });

  it('rejects missing, dangling, terminal and backwards step assignments', () => {
    const draft = grouped();
    const missing = structuredClone(draft);
    delete missing.steps[0]!.bucketId;
    expect(() => workflowDefinitionCheck(missing)).toThrow('bucket');
    const unknown = structuredClone(draft);
    unknown.steps[0]!.bucketId = 'missing';
    expect(() => workflowDefinitionCheck(unknown)).toThrow('bucket');
    const accepted = structuredClone(draft);
    accepted.steps.at(-1)!.bucketId = 'done';
    expect(() => workflowDefinitionCheck(accepted)).toThrow('Accepted');
    const backwards = structuredClone(draft);
    backwards.steps[0]!.bucketId = 'design';
    expect(() => workflowDefinitionCheck(backwards)).toThrow('order');
    const orphan = structuredClone(draft);
    delete orphan.buckets;
    expect(() => workflowDefinitionCheck(orphan)).toThrow('bucket');
  });

  it('allows empty intermediate buckets but preserves required earlier-result validation', () => {
    const draft = grouped();
    draft.buckets!.splice(2, 0, { id: 'research', name: 'Research', description: '', role: 'process' });
    expect(workflowDefinitionCheck(draft)).toEqual(draft);
    draft.steps[0] = { ...ai('consumer'), bucketId: 'inbox', inputs: ['design'] };
    expect(() => workflowDefinitionCheck(draft)).toThrow('preceding');
  });

  it.each([
    { id: '' }, { id: 'x'.repeat(81) }, { id: 'invalid:id' },
    { name: '   ' }, { name: 'x'.repeat(101) }, { description: 'x'.repeat(1001) },
    { role: 'automatic-acceptance' },
  ])('rejects out-of-contract bucket fields %j', patch => {
    const draft = grouped();
    const buckets = draft.buckets!.map((bucket, index) => index === 1 ? { ...bucket, ...patch } : bucket);
    expect(() => workflowDefinitionCheck({ ...draft, buckets })).toThrow();
  });

  it('permits both bounded endpoint-only and twelve-bucket processes without adding execution', () => {
    const minimum = grouped();
    minimum.buckets = minimum.buckets!.filter(bucket => bucket.role !== 'process');
    minimum.steps.forEach(step => { step.bucketId = 'inbox'; });
    expect(workflowDefinitionCheck(minimum)).toEqual(minimum);
    const maximum = grouped();
    maximum.buckets!.splice(1, 0, ...Array.from({ length: 7 }, (_, index) => ({
      id: `empty-${index}`, name: `Empty ${index}`, description: '', role: 'process' as const,
    })));
    expect(workflowDefinitionCheck(maximum)).toEqual(maximum);
    expect(maximum.steps.map(step => step.id)).toEqual(minimum.steps.map(step => step.id));
  });
});
