import { describe, expect, it } from 'vitest';
import { workflowBoardColumns } from '../../../features/coforge/domain/workflow-board';
import { materializeWorkflowBuckets } from '../../../features/coforge/domain/workflow-buckets';
import { defaultWorkflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowArtifactHash, workflowProposalRevision, type WorkflowRun } from '../../../features/coforge/domain/configured-workflow-run';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { createSeed, defaultSettings } from '../../../features/coforge/domain/seed';
import type { Idea } from '../../../features/coforge/domain/types';

const at = '2026-10-31T12:00:00Z';
const grouped = () => materializeWorkflowBuckets(defaultWorkflowDefinition(defaultSettings()));
function ideaWithRun(cursor = 2, state: WorkflowRun['state'] = 'ready'): Idea {
  const idea = structuredClone(createSeed().ideas.find(item => item.status === 'ranked')!);
  idea.workflowRun = { id: 'run', ideaId: idea.id, projectId: idea.projectId ?? 'CFP-001', definition: grouped(),
    proposalRevision: workflowProposalRevision(idea), revision: 1, cursor, state, attempts: [], artifacts: [], createdAt: at, updatedAt: at };
  return idea;
}
const containing = (definition: ReturnType<typeof grouped>, idea: Idea, holds: string[] = []) =>
  workflowBoardColumns(definition, [idea], holds).filter(column => column.ideas.length);

describe('private configured workflow board placement', () => {
  it('uses configured names/order and keeps each request exactly once without mutating its captured definition', () => {
    const definition = grouped();
    definition.buckets!.splice(2, 0, { id: 'research', name: 'Discovery', description: 'Understand the opportunity', role: 'process' });
    definition.buckets![0]!.name = 'New arrivals';
    const idea = ideaWithRun();
    idea.workflowRun!.definition = structuredClone(definition);
    const before = JSON.stringify(idea);
    const columns = workflowBoardColumns(definition, [idea]);
    expect(columns.map(column => column.title)).toEqual(['New arrivals', 'Up next', 'Discovery', 'Design', 'In progress', 'Accepted']);
    expect(columns.flatMap(column => column.ideas.map(item => item.id))).toEqual([idea.id]);
    expect(columns.find(column => column.id === 'inbox')?.canAdd).toBe(true);
    expect(JSON.stringify(idea)).toBe(before);
  });

  it('retains occupied renamed and removed captured buckets as Earlier workflow columns', () => {
    const idea = ideaWithRun();
    const current = grouped();
    current.buckets![1]!.name = 'Prioritized';
    const renamed = containing(current, idea);
    expect(renamed).toHaveLength(1);
    expect(renamed[0]).toMatchObject({ title: 'Up next', earlierWorkflow: true });
    expect(renamed[0]!.hint).toContain('Earlier workflow');
    expect(workflowBoardColumns(current, [idea]).at(-1)?.id).toBe('done');
    current.buckets = current.buckets!.filter(bucket => bucket.id !== 'next');
    current.steps.find(step => step.id === 'plan')!.bucketId = 'inbox';
    expect(containing(current, idea)[0]).toMatchObject({ title: 'Up next', earlierWorkflow: true });
    expect(workflowBoardColumns(current, []).some(column => column.earlierWorkflow)).toBe(false);
    current.buckets!.find(bucket => bucket.id === 'design')!.name = 'Specification';
    const designIdea = ideaWithRun(3);
    designIdea.id = 'CF-998'; designIdea.workflowRun!.ideaId = designIdea.id;
    designIdea.workflowRun!.proposalRevision = workflowProposalRevision(designIdea);
    expect(workflowBoardColumns(current, [designIdea, idea]).filter(column => column.earlierWorkflow).map(column => column.title)).toEqual(['Up next', 'Design']);
  });

  it('uses the captured active bucket and retains no-code completion outside Accepted', () => {
    const idea = ideaWithRun(3, 'waiting-human');
    expect(containing(grouped(), idea)[0]?.id).toBe('design');
    idea.workflowRun!.state = 'finished';
    idea.workflowRun!.cursor = idea.workflowRun!.definition.steps.length;
    expect(containing(grouped(), idea)[0]?.id).toBe('progress');
    expect(idea.status).toBe('ranked');
  });

  it('keeps historical column order stable when request ranking changes across captured definitions', () => {
    const first = ideaWithRun(2);
    first.workflowRun!.definition.revision = 'older-a';
    const second = ideaWithRun(2);
    second.id = 'CF-998'; second.workflowRun!.ideaId = second.id; second.workflowRun!.id = 'second-run';
    second.workflowRun!.proposalRevision = workflowProposalRevision(second);
    second.workflowRun!.definition.revision = 'older-b';
    second.workflowRun!.definition.buckets![1]!.name = 'Explore';
    const current = grouped(); current.buckets![1]!.name = 'Prioritized';
    const earlierIds = (ideas: Idea[]) => workflowBoardColumns(current, ideas).filter(column => column.earlierWorkflow).map(column => column.id);
    expect(earlierIds([first, second])).toEqual(earlierIds([second, first]));
    expect(earlierIds([first, second])).toHaveLength(2);
  });

  it('keeps endpoint roles current and allows an ordinary process bucket named archive', () => {
    const definition = grouped();
    definition.buckets![0]!.name = 'New intake';
    definition.buckets![1]!.id = 'archive';
    definition.steps.find(step => step.id === 'plan')!.bucketId = 'archive';
    const idea = ideaWithRun(0);
    expect(containing(definition, idea)[0]).toMatchObject({ id: 'inbox', title: 'New intake' });
    idea.workflowRun!.definition = structuredClone(definition); idea.workflowRun!.cursor = 2;
    const rejected = { ...idea, id: 'CF-999', status: 'rejected' as const };
    const columns = workflowBoardColumns(definition, [idea, rejected]);
    expect(columns.find(column => column.id === 'archive')?.ideas).toEqual([idea]);
    expect(new Set(columns.map(column => column.id)).size).toBe(columns.length);
    definition.buckets![1]!.id = 'constructor';
    definition.steps.find(step => step.id === 'plan')!.bucketId = 'constructor';
    expect(workflowBoardColumns(definition, []).find(column => column.id === 'constructor')).toMatchObject({ icon: 'circle-dot', tone: 'progress' });
  });

  it('keeps successful current Design in Design until Build starts, including queued Build', () => {
    const idea = ideaWithRun(4);
    const run = idea.workflowRun!;
    const artifact = { id: 'spec', runId: run.id, stepId: 'design', attemptId: 'design-attempt', proposalRevision: run.proposalRevision,
      output: 'design' as const, markdown: '# Design', createdAt: at };
    run.artifacts.push({ ...artifact, contentHash: workflowArtifactHash(artifact) });
    run.attempts.push({ id: 'design-attempt', stepId: 'design', stepName: 'Design', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at });
    expect(containing(grouped(), idea)[0]?.id).toBe('design');
    run.state = 'running';
    run.attempts.push({ id: 'build-attempt', stepId: 'implement', stepName: 'Build', kind: 'ai', status: 'queued', inputs: [], startedAt: at });
    expect(containing(grouped(), idea)[0]?.id).toBe('design');
    run.attempts.at(-1)!.status = 'running';
    expect(containing(grouped(), idea)[0]?.id).toBe('progress');
    run.attempts.at(-1)!.status = 'failed'; run.state = 'attention';
    expect(containing(grouped(), idea)[0]?.id).toBe('progress');
    run.attempts.at(-1)!.status = 'cancelled';
    expect(containing(grouped(), idea)[0]?.id).toBe('progress');
    run.attempts.pop(); run.invalidatedArtifactIds = ['spec']; run.state = 'ready';
    expect(containing(grouped(), idea)[0]?.id).toBe('progress');
  });

  it('retains current Design readiness after a manual checkpoint before Build', () => {
    const idea = ideaWithRun(5);
    const run = idea.workflowRun!;
    run.definition.steps.splice(4, 0, { id: 'checkpoint', bucketId: 'design', name: 'Review specification', kind: 'approval', instructions: '' });
    const artifact = { id: 'spec', runId: run.id, stepId: 'design', attemptId: 'design-attempt', proposalRevision: run.proposalRevision,
      output: 'design' as const, markdown: '# Design', createdAt: at };
    run.artifacts.push({ ...artifact, contentHash: workflowArtifactHash(artifact) });
    run.attempts.push({ id: 'design-attempt', stepId: 'design', stepName: 'Design', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at });
    run.attempts.push({ id: 'checkpoint-attempt', stepId: 'checkpoint', stepName: 'Review specification', kind: 'approval', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at });
    expect(containing(grouped(), idea)[0]?.id).toBe('design');
  });

  it('prioritizes holds, moderation, closed outcomes and stale request revisions over captured progress', () => {
    const definition = grouped();
    const idea = ideaWithRun(3);
    expect(containing(definition, idea, [idea.id])[0]?.id).toBe('inbox');
    idea.workflowRun!.state = 'stopped';
    expect(containing(definition, idea)[0]?.id).toBe('inbox');
    idea.workflowRun!.state = 'ready'; idea.status = 'flagged';
    expect(containing(definition, idea)[0]?.id).toBe('inbox');
    idea.status = 'shipped';
    expect(containing(definition, idea, [idea.id])[0]?.id).toBe('done');
    idea.status = 'rejected';
    expect(containing(definition, idea)[0]?.archived).toBe(true);
    idea.status = 'ranked'; idea.description += ' changed';
    expect(containing(definition, idea)[0]?.id).toBe('next');
  });

  it.each(['markdown', 'runId', 'attemptId'] as const)('does not claim Design completion with invalid %s evidence', field => {
    const idea = ideaWithRun(4);
    const run = idea.workflowRun!;
    const artifact = { id: 'spec', runId: run.id, stepId: 'design', attemptId: 'design-attempt', proposalRevision: run.proposalRevision,
      output: 'design' as const, markdown: '# Design', createdAt: at };
    const captured = { ...artifact, contentHash: workflowArtifactHash(artifact) };
    run.artifacts.push(captured);
    run.attempts.push({ id: 'design-attempt', stepId: 'design', stepName: 'Design', kind: 'ai', status: 'succeeded', inputs: [], startedAt: at, finishedAt: at });
    captured[field] = 'changed';
    if (field !== 'markdown') captured.contentHash = workflowArtifactHash(captured);
    expect(containing(grouped(), idea)[0]?.id).toBe('progress');
  });

  it('keeps legacy lifecycle placement discoverable after intermediate default buckets are removed', () => {
    const current = grouped();
    current.buckets = current.buckets!.filter(bucket => bucket.role !== 'process');
    current.steps.forEach(step => { step.bucketId = 'inbox'; });
    const ideas = createSeed().ideas;
    const columns = workflowBoardColumns(current, ideas);
    expect(columns.flatMap(column => column.ideas)).toHaveLength(ideas.length);
    expect(new Set(columns.flatMap(column => column.ideas.map(idea => idea.id))).size).toBe(ideas.length);
    expect(columns.find(column => column.title === 'Design')).toMatchObject({ earlierWorkflow: true });
  });

  it('keeps private bucket configuration out of the public board and retains screened lifecycle columns', () => {
    const state = createSeed();
    const definition = grouped();
    definition.buckets![1]!.name = 'PRIVATE_BUCKET_NAME';
    definition.buckets![1]!.description = 'PRIVATE_BUCKET_DESCRIPTION';
    state.settings.workflow = definition;
    const board = buildPublicBoard(state);
    expect(board.columns.map(column => column.title)).toEqual(['Inbox', 'Up next', 'Design', 'In progress', 'Accepted']);
    expect(JSON.stringify(board)).not.toContain('PRIVATE_BUCKET');
    expect(board.columns.flatMap(column => column.ideas).some(idea => idea.id === 'CF-107' || idea.id === 'CF-114')).toBe(false);
  });
});
