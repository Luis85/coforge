import { expect, it, vi } from 'vitest';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { mergeNote, StudioStore } from '../../../features/coforge/application/studio-store';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { sampleIncrement } from '../../../features/coforge/domain/seed';
import { nodeTimers, seededStore } from './memory-storage';

it('retains private configured provenance after managed note fields are removed and prevents legacy acceptance bypass', async () => {
  const { store, storage } = await seededStore();
  await store.transaction(state => {
    const idea = state.ideas.find(idea => idea.id === 'CF-107')!;
    const at = new Date().toISOString();
    idea.status = 'review';
    idea.increment = { ...sampleIncrement(idea.title, at), simulated: false, worktree: '/synthetic/workspace' };
    idea.workflowRun = { id: 'run-one', ideaId: idea.id, projectId: idea.projectId!, definition: workflowDefinition(state.settings),
      proposalRevision: workflowProposalRevision(idea), revision: 1, cursor: 4, state: 'awaiting-review',
      attempts: [], artifacts: [], workspaceId: 'workspace-one', createdAt: at, updatedAt: at };
  });
  const loaded = await storage.load();
  const original = structuredClone(loaded.notes.find(idea => idea.id === 'CF-107')!);
  const note = loaded.notes.find(idea => idea.id === 'CF-107')!;
  delete note.workflowRun;
  delete note.workflowHistory;
  const reloaded = new StudioStore({ load: async () => loaded, save: async () => {} });
  await reloaded.init();
  const reviewGuard = vi.fn(async (): Promise<void> => { throw new Error('Workspace inspection required'); });
  const runner = async () => { throw new Error('No model should run'); };
  const engine = new WorkflowEngine(reloaded, { runners: { demo: runner, claude: runner }, timers: nodeTimers(), assertWorkflowReviewable: reviewGuard });
  try {
    await expect(engine.action('CF-107', 'approve')).rejects.toThrow(/workflow|managed/i);
    expect(reloaded.snapshot().ideas.find(idea => idea.id === 'CF-107')?.status).toBe('review');
    expect(reloaded.internalSnapshot().integrity['workflow:CF-107']).toBe(loaded.data?.integrity['workflow:CF-107']);
    expect(reviewGuard).not.toHaveBeenCalled();
    // Restoring the original canonical data still requires the native workspace guard.
    await reloaded.transaction(state => { mergeNote(state, original); }, { fromNotes: [original.id] });
    await expect(engine.action('CF-107', 'approve')).rejects.toThrow('Workspace inspection required');
    expect(reviewGuard).toHaveBeenCalledOnce();
    reviewGuard.mockImplementation(async () => {});
    await reloaded.transaction(state => { state.ideas.find(idea => idea.id === 'CF-107')!.description += ' New viewer context changes this request.'; });
    await expect(engine.action('CF-107', 'approve')).rejects.toThrow(/request.*changed/i);
    expect(reloaded.snapshot().ideas.find(idea => idea.id === 'CF-107')?.status).toBe('review');
  } finally { await engine.stop(); }
});
