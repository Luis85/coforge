import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { atomicExistingFixture } from './atomic-command-fixture';

it('removes only the confirmed card, trashes the original note name and retains private history across reload', async () => {
  const f = await atomicExistingFixture();
  try {
    await f.studio.store.transaction(state => {
      state.ideas[0]!.voters = ['simulator:viewer'];
      state.jobs.push({ id: 'old-task', ideaId: f.idea.id, projectId: f.idea.projectId, stage: 'score', provider: 'demo', status: 'succeeded', startedAt: f.idea.createdAt, logs: ['Retained evidence'], costUsd: 0.1 });
    });
    const before = f.kit.read(f.file.path);
    const preview = await f.studio.previewRequestDeletion(f.idea.id);
    await f.studio.deleteRequest(preview);
    expect(f.studio.state().ideas.some(idea => idea.id === f.idea.id)).toBe(false);
    expect(f.app.vault.getFileByPath(f.file.path)).toBeNull();
    expect(f.kit.vault.trashed.at(-1)).toMatchObject({ system: true, data: before });
    expect(f.kit.vault.trashed.at(-1)?.path.endsWith(f.file.name)).toBe(true);
    const recovery = f.app.vault.getFiles().find(file => file.path.endsWith('/request.coforge-recovery'));
    expect(recovery).toBeDefined(); expect(f.kit.read(recovery!.path)).toBe(before);
    expect(f.studio.state().jobs.find(job => job.id === 'old-task')?.logs).toEqual(['Retained evidence']);
    expect(f.studio.state().deletedRequests?.at(-1)).toMatchObject({ id: f.idea.id, title: f.idea.title, voters: ['simulator:viewer'] });
    const costs = f.studio.store.aiCostSnapshot([]);
    expect(costs.find(task => task.id === 'job:old-task')).toMatchObject({ featureTitle: f.idea.title, reportedUsd: 0.1 });
    const herdr = f.studio.store.aiCostSnapshot([{ id: 'old-herdr', kind: 'dispatch', session: 'fixture', projectId: f.idea.projectId ?? 'CFP-001', ideaId: f.idea.id, at: f.idea.createdAt, status: 'reviewed' }]);
    expect(herdr.find(task => task.id === 'herdr:old-herdr')?.featureTitle).toBe(f.idea.title);
    const restored = new StudioStore(f.storage); await restored.init();
    expect(restored.snapshot().ideas.some(idea => idea.id === f.idea.id)).toBe(false);
    expect(restored.snapshot().deletedRequests?.at(-1)?.id).toBe(f.idea.id);
  } finally { await f.studio.stop(); }
});

it('preserves the exact note and board card when the data commit fails', async () => {
  const f = await atomicExistingFixture(); const original = f.app.vault.adapter.write.bind(f.app.vault.adapter);
  try {
    const preview = await f.studio.previewRequestDeletion(f.idea.id); const before = f.kit.read(f.file.path);
    let fail = true;
    vi.spyOn(f.app.vault.adapter, 'write').mockImplementation(async (path, bytes) => { if (path === f.storage.dataPath && fail) { fail = false; throw new Error('Disk unavailable'); } await original(path, bytes); });
    await expect(f.studio.deleteRequest(preview)).rejects.toThrow('Disk unavailable');
    expect(f.kit.read(f.file.path)).toBe(before);
    expect(f.studio.state().ideas.some(idea => idea.id === f.idea.id)).toBe(true);
    expect(f.studio.state().deletedRequests ?? []).toEqual([]); expect(f.kit.vault.trashed).toEqual([]);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it('refuses stale note or state previews without removing another request', async () => {
  const f = await atomicExistingFixture();
  try {
    const preview = await f.studio.previewRequestDeletion(f.idea.id);
    await f.app.vault.process(f.file, text => text + '\nHuman annotation\n');
    await expect(f.studio.deleteRequest(preview)).rejects.toThrow(/changed|stale|preview/i);
    expect(f.kit.read(f.file.path)).toContain('Human annotation'); expect(f.kit.vault.trashed).toEqual([]);
    const refreshed = await f.studio.previewRequestDeletion(f.idea.id);
    await f.studio.vote(f.idea.id);
    await expect(f.studio.deleteRequest(refreshed)).rejects.toThrow(/changed|preview/i);
    expect(f.studio.state().ideas).toHaveLength(1);
  } finally { await f.studio.stop(); }
});

it.each(['queued', 'running'] as const)('requires %s work to settle before deletion and rechecks after preview', async status => {
  const f = await atomicExistingFixture();
  try {
    const preview = await f.studio.previewRequestDeletion(f.idea.id);
    await f.studio.store.transaction(state => { state.jobs.push({ id: 'active', ideaId: f.idea.id, provider: 'demo', stage: 'score', status, startedAt: f.idea.createdAt, logs: [] }); });
    await expect(f.studio.deleteRequest(preview)).rejects.toThrow(/active|queued|running|changed|settle/i);
    await expect(f.studio.previewRequestDeletion(f.idea.id)).rejects.toThrow(/active|queued|running|settle/i);
    expect(f.app.vault.getFileByPath(f.file.path)).not.toBeNull(); expect(f.kit.vault.trashed).toEqual([]);
  } finally { await f.studio.stop(); }
});
