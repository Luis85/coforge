import { expect, it } from 'vitest';
import { AICostService } from '../../../features/coforge/application/ai-cost-service';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import type { AICostTask } from '../../../features/coforge/domain/ai-costs';
import { nodeTimers } from './memory-storage';
import { workflowUiFixture } from './workflow-ui-fixture';

it('removes only old simulation costs for exact removed requests and recovers filtering on refresh and reload', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.loadSample();
  const removed = fixture.studio.state().ideas[0]!.id;
  await fixture.studio.createIdea({ title: 'Real manual feature with demo AI', description: 'Keep my real idea and its simulation history.', category: 'Gameplay', username: 'Owner' });
  const manual = fixture.studio.state().ideas.at(-1)!.id;
  await fixture.studio.ingest({ source: 'twitch', userId: '82', username: 'Live', text: '!register' });
  const live = await fixture.studio.ingest({ source: 'twitch', userId: '82', username: 'Live', text: `!request ${fixture.project.id} A genuine live viewer feature` });
  const task = (id: string, provider: AICostTask['provider'], featureId = removed): AICostTask => ({ id, provider, featureId, featureTitle: id, projectId: fixture.project.id, projectName: 'Real project', stage: 'screen', status: 'succeeded', startedAt: '2026-01-01T00:00:00Z' });
  const source: AICostTask[] = [
    task('removed-demo', 'demo'),
    { ...task('real-reported', 'claude'), reportedUsd: 0.75 },
    { ...task('real-manual', 'herdr'), manualUsd: '0.25', manualNote: 'Paid provider invoice' },
    task('retained-manual-demo', 'demo', manual),
    task('retained-twitch-demo', 'demo', live.ideaId!),
    { ...task('manual-evidence-even-on-demo', 'demo'), manualUsd: '0.10', manualNote: 'Historical manual evidence' },
  ];
  let saved: AICostTask[] = [];
  const storage = { load: async () => structuredClone(saved), save: async (tasks: AICostTask[]) => { saved = structuredClone(tasks); } };
  const service = new AICostService(fixture.studio.store, storage, () => source, nodeTimers());
  let reopened: AICostService | undefined;
  let restartedStore: StudioStore | undefined;
  try {
    await service.start();
    const preview = await fixture.studio.previewExampleCleanup();
    fixture.storage.failNextSave = true;
    await expect(fixture.studio.removeExampleContent(preview)).rejects.toThrow('Disk full');
    expect(fixture.studio.state().exampleRemovalCutoffs).toBeUndefined();
    await service.refresh();
    expect(service.snapshot().tasks.some(task => task.id === 'removed-demo')).toBe(true);
    await fixture.studio.removeExampleContent(preview);
    await expect.poll(() => service.snapshot().tasks.some(task => task.id === 'removed-demo')).toBe(false);
    expect(service.snapshot().tasks.map(task => task.id)).toEqual(source.slice(1).map(task => task.id));
    source.push({ ...task('new-generation-same-id', 'demo'), startedAt: '2099-01-01T00:00:00Z' });
    await service.refresh();
    expect(service.snapshot().tasks.some(task => task.id === 'new-generation-same-id')).toBe(true);
    expect(service.snapshot().tasks.some(task => task.id === 'removed-demo')).toBe(false);
    await service.dispose();
    restartedStore = new StudioStore(fixture.storage);
    await restartedStore.init();
    expect(restartedStore.exampleCostRemovalCutoffs()[removed]).toBeDefined();
    saved = [...saved, source[0]!]; // A crash or stale ledger can return an older row.
    reopened = new AICostService(restartedStore, storage, () => source, nodeTimers());
    await reopened.start();
    expect(reopened.snapshot().tasks.some(task => task.id === 'removed-demo')).toBe(false);
    expect(reopened.snapshot().tasks.find(task => task.id === 'real-reported')?.reportedUsd).toBe(0.75);
    expect(reopened.snapshot().tasks.find(task => task.id === 'real-manual')?.manualUsd).toBe('0.25');
    expect(reopened.snapshot().tasks.some(task => task.id === 'new-generation-same-id')).toBe(true);
  } finally { await service.dispose(); await reopened?.dispose(); restartedStore?.disposeObservers(); await fixture.dispose(); }
});
