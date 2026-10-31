import { describe, expect, it } from 'vitest';
import { saveProjectWorkflow } from '../../../features/coforge/application/workflow-configuration';
import { prepareWorkflowCopy } from '../../../features/coforge/application/workflow-copy';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowRunCheck } from '../../../features/coforge/domain/configured-workflow-run';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { applyProjectProperties, parseProjectNote, projectProperties } from '../../../features/coforge/domain/project-note';
import { materializeWorkflowBuckets } from '../../../features/coforge/domain/workflow-buckets';
import { ai, fixture } from './configured-workflow-fixture';
import { seededStore } from './memory-storage';

describe('bucket workflow persistence and capture', () => {
  it('saves grouping atomically for future runs without reinterpreting a legacy captured run', async () => {
    const { store, storage } = await seededStore();
    const original = workflowDefinition(store.snapshot().settings);
    const projectId = store.snapshot().activeProjectId!;
    const now = new Date().toISOString();
    const run = workflowRunCheck({ id: 'old-run', ideaId: 'CF-107', projectId, definition: original,
      proposalRevision: 'proposal', revision: 1, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: now, updatedAt: now });
    await store.transaction(state => { state.ideas.find(idea => idea.id === 'CF-107')!.workflowRun = run; });
    const draft = materializeWorkflowBuckets(original);
    draft.buckets![1]!.name = 'Explore';
    draft.buckets![1]!.description = 'Decide {{next}} with [[references]].';
    const saved = await saveProjectWorkflow(store, projectId, draft, JSON.stringify(original));
    expect(saved.settings.workflow?.buckets).toEqual(draft.buckets);
    expect(saved.settings.workflow?.steps).toEqual(draft.steps);
    expect(saved.settings.workflow?.revision).not.toBe(original.revision);
    expect(store.snapshot().ideas.find(idea => idea.id === 'CF-107')?.workflowRun).toEqual(run);
    const loaded = await storage.load();
    expect(loaded.projects?.find(project => project.id === projectId)?.settings.workflow).toEqual(saved.settings.workflow);
    expect(loaded.notes.find(idea => idea.id === 'CF-107')?.workflowRun?.definition).toEqual(original);
    expect(store.snapshot().jobs).toHaveLength(0);
    const writes = storage.saves;
    await expect(saveProjectWorkflow(store, projectId, draft, JSON.stringify(original))).rejects.toThrow('draft was preserved');
    expect(storage.saves).toBe(writes);
  });

  it('leaves canonical data and authored draft intact when bucket persistence fails', async () => {
    const { store, storage } = await seededStore();
    const original = workflowDefinition(store.snapshot().settings);
    const draft = materializeWorkflowBuckets(original);
    const before = structuredClone(draft);
    storage.failNextSave = true;
    await expect(saveProjectWorkflow(store, store.snapshot().activeProjectId!, draft, JSON.stringify(original))).rejects.toThrow('Disk full');
    expect(store.snapshot().settings.workflow).toBeUndefined();
    expect(draft).toEqual(before);
    expect(store.snapshot().jobs).toHaveLength(0);
  });

  it('round-trips authored bucket strings through canonical project properties and preserves annotations', async () => {
    const { store } = await seededStore();
    const project = store.snapshot().projects![0]!;
    project.settings.workflow = materializeWorkflowBuckets(workflowDefinition(project.settings));
    project.settings.workflow.buckets![1]!.description = 'Keep [[note]] {{template}} e\u0301 and \u2060\r\nbody exactly.';
    const properties = { ...projectProperties(project), annotation: 'Human note' };
    expect(parseProjectNote(properties)?.settings.workflow).toEqual(project.settings.workflow);
    const edited = structuredClone(project);
    edited.settings.workflow!.buckets![1]!.name = 'Research';
    applyProjectProperties(properties, edited);
    expect(properties.annotation).toBe('Human note');
    expect(parseProjectNote(properties)?.settings.workflow).toEqual(edited.settings.workflow);
  });

  it('copies every bucket independently while retaining destination-reference repair', async () => {
    const { store } = await seededStore();
    const source = materializeWorkflowBuckets(workflowDefinition(store.snapshot().settings));
    const first = source.steps[0]!;
    if (first.kind !== 'ai') throw new Error('Expected AI fixture');
    first.outputTemplateId = 'source-template';
    const before = structuredClone(source);
    const copied = prepareWorkflowCopy(source, 'destination-revision');
    expect(copied.definition.buckets).toEqual(source.buckets);
    expect(copied.definition.steps.map(step => step.bucketId)).toEqual(source.steps.map(step => step.bucketId));
    expect(copied.definition.steps[0]).not.toHaveProperty('outputTemplateId');
    expect(copied.warnings.join(' ')).toContain('source project');
    copied.definition.buckets![1]!.description = 'Independent destination';
    expect(source).toEqual(before);
  });

  it('executes captured bucket assignments through the existing kernel and manual gate after later edits', async () => {
    const f = await fixture([ai('research', 'plan'), { id: 'approval', name: 'Inspect', kind: 'approval', instructions: 'Review research' }, ai('report', 'design')]);
    await f.store.transaction(state => {
      state.settings.workflow = materializeWorkflowBuckets(state.settings.workflow!);
    });
    const captured = workflowDefinition(f.store.snapshot().settings);
    try {
      await f.engine.startWorkflow(f.idea.id);
      await f.engine.waitUntilIdle();
      expect(f.current().workflowRun?.state).toBe('waiting-human');
      expect(f.calls.map(input => input.workflow?.step.bucketId)).toEqual(['next']);
      const projectId = f.store.snapshot().activeProjectId!;
      const replacement = structuredClone(captured);
      replacement.buckets![1]!.name = 'Future only';
      replacement.steps = replacement.steps.slice(0, 1);
      await saveProjectWorkflow(f.store, projectId, replacement, JSON.stringify(captured));
      const waiting = f.current().workflowRun!;
      expect(waiting.definition).toEqual(captured);
      await f.engine.completeWorkflowManual(f.idea.id, waiting.revision, []);
      await f.engine.waitUntilIdle();
      expect(f.calls.map(input => [input.workflow?.step.id, input.workflow?.step.bucketId])).toEqual([['research', 'next'], ['report', 'design']]);
      expect(f.current().workflowRun?.definition).toEqual(captured);
      expect(f.current().workflowRun?.state).toBe('finished');
      expect(f.current().status).not.toBe('shipped');
      const loaded = await f.storage.load();
      expect(loaded.notes.find(idea => idea.id === f.idea.id)?.workflowRun?.definition).toEqual(captured);
      expect(parsePersistedStudio(loaded.data).jobs.map(job => job.workflow?.step.bucketId)).toEqual(['next', 'design']);
    } finally { await f.engine.stop(); }
  });
});
