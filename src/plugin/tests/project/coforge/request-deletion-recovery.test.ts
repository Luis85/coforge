import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { atomicExistingFixture } from './atomic-command-fixture';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { sampleIncrement, samplePlan } from '../../../features/coforge/domain/seed';
import { workflowDefinition } from '../../../features/coforge/domain/configured-workflow';
import { workflowProposalRevision } from '../../../features/coforge/domain/configured-workflow-run';
import { buildPublicBoard } from '../../../features/coforge/domain/public-board';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { streamSurfaceSnapshot } from '../../../features/coforge/domain/stream-surfaces';

it('restores votes and preserved changes after the operator restores the note, with execution held for review', async () => {
  const f = await atomicExistingFixture();
  try {
    vi.spyOn(f.app.fileManager, 'trashFile').mockImplementation(file => f.app.vault.trash(file, false));
    const original = f.file.path; const filename = f.file.name;
    await f.app.vault.process(f.file, text => text.replace('type: coforge-idea', 'annotation: keep\ntype: coforge-idea') + '\nHuman note bytes.\n');
    await f.studio.store.transaction(state => { state.ideas[0]!.voters = ['simulator:viewer']; state.ideas[0]!.increment = sampleIncrement('Retained code', f.idea.createdAt); state.ideas[0]!.plan = samplePlan('Archived plan', f.idea.createdAt); });
    const before = f.kit.read(original);
    await f.studio.deleteRequest(await f.studio.previewRequestDeletion(f.idea.id));
    expect(f.studio.state().deletedRequests?.at(-1)?.proposal?.properties['plan-summary']).toContain('Archived plan');
    expect(f.kit.read(`.trash/${filename}`)).toBe(before);
    expect(JSON.stringify(buildPublicBoard(f.studio.state()))).not.toContain(f.idea.title);
    expect(JSON.stringify(streamSurfaceSnapshot(f.studio.state(), { channelId: 'fixture', liveSince: 0 }))).not.toContain('Archived plan');
    await f.app.vault.adapter.rename(`.trash/${filename}`, original);
    const restored = new StudioStore(f.storage); await restored.init();
    expect(restored.snapshot().ideas[0]).toMatchObject({ id: f.idea.id, voters: ['simulator:viewer'], increment: { summary: expect.stringContaining('Retained code') }, status: 'inbox' });
    expect(restored.snapshot().ideas[0]?.screening).toBeUndefined();
    expect(f.kit.read(original).split('---').slice(2).join('---')).toBe(before.split('---').slice(2).join('---'));
    expect(f.kit.read(original)).toContain('annotation: keep');
    await restored.transaction(state => { const increment = state.ideas[0]?.increment; if (increment) increment.summary = 'Later restored review'; });
    expect(restored.snapshot().deletedRequests?.at(-1)?.increment?.summary).not.toBe('Later restored review');
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it('retains a committed note in the distinct recovery folder when trash fails, then finishes recovery on reload', async () => {
  const f = await atomicExistingFixture();
  try {
    const before = f.kit.read(f.file.path);
    vi.spyOn(f.app.vault, 'trash').mockRejectedValue(new Error('Trash unavailable'));
    await f.studio.deleteRequest(await f.studio.previewRequestDeletion(f.idea.id));
    expect(f.studio.state().ideas).toEqual([]);
    expect(f.studio.requestDeletionWarning()).toContain('CoForge/Recovery/RequestDeletion');
    const retained = f.app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Recovery/RequestDeletion/'))!;
    expect(f.kit.read(retained.path)).toBe(before);
    vi.restoreAllMocks();
    const loaded = await f.storage.load(); expect(loaded.notes).toEqual([]);
    expect(f.kit.vault.trashed.at(-1)?.data).toBe(before);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it.each([false, true])('reconciles an interrupted removal with committed=%s before loading notes', async committed => {
  const f = await atomicExistingFixture();
  try {
    const original = f.file.path; const before = f.kit.read(original); const beforeData = f.kit.read(f.storage.dataPath);
    const directory = 'CoForge/Recovery/RequestDeletion/00000000-0000-4000-8000-000000000001';
    const staged = `${directory}/0/${f.file.name}`;
    const after = parsePersistedStudio(JSON.parse(beforeData));
    after.deletedRequests = [{ id: f.idea.id, title: f.idea.title, projectId: f.idea.projectId ?? 'CFP-001', projectName: 'Archived project', createdAt: f.idea.createdAt, deletedAt: new Date().toISOString(), voters: [] }];
    const afterData = JSON.stringify(after); const hash = (text: string) => createHash('sha256').update(text).digest('hex');
    await f.app.vault.createFolder(`${directory}/0`);
    await f.app.vault.adapter.write(f.storage.dataPath.replace('coforge-state.json', 'coforge-request-deletion.json'), JSON.stringify({ schema: 1, directory, beforeData, afterHash: hash(afterData),
      notes: [{ id: f.idea.id, original, staged, fingerprint: hash(before) }] }));
    await f.app.vault.rename(f.file, staged); if (committed) await f.app.vault.adapter.write(f.storage.dataPath, afterData);
    const loaded = await f.storage.load();
    if (committed) { expect(loaded.notes).toEqual([]); expect(f.kit.vault.trashed.at(-1)?.data).toBe(before); }
    else { expect(loaded.notes[0]?.id).toBe(f.idea.id); expect(f.kit.read(original)).toBe(before); expect(f.kit.vault.trashed).toEqual([]); }
  } finally { await f.studio.stop(); }
});

it('requires an explicit stop for a pending workflow and retains its captured history on deletion', async () => {
  const f = await atomicExistingFixture();
  try {
    await f.studio.store.transaction(state => { const idea = state.ideas[0]!; idea.workflowRun = { id: 'pending-delete-run', ideaId: idea.id, projectId: idea.projectId!, definition: workflowDefinition(state.settings),
      proposalRevision: workflowProposalRevision(idea), revision: 0, cursor: 0, state: 'ready', attempts: [], artifacts: [], createdAt: idea.createdAt, updatedAt: idea.updatedAt }; });
    await expect(f.studio.previewRequestDeletion(f.idea.id)).rejects.toThrow(/stop/i);
    await f.studio.stopWorkflow(f.idea.id);
    await f.studio.deleteRequest(await f.studio.previewRequestDeletion(f.idea.id));
    expect(f.studio.state().deletedRequests?.at(-1)?.workflowRun).toMatchObject({ id: 'pending-delete-run', state: 'stopped' });
  } finally { await f.studio.stop(); }
});

it('preserves an outstanding trash-recovery journal instead of overwriting it with another deletion', async () => {
  const f = await atomicExistingFixture();
  try {
    await f.studio.createIdea({ title: 'Keep until trash recovers', description: 'Another deletion must wait.', category: 'Gameplay', username: 'Owner' });
    const other = f.studio.state().ideas.find(idea => idea.id !== f.idea.id)!;
    const otherPath = f.storage.file(other.id)!.path;
    vi.spyOn(f.app.fileManager, 'trashFile').mockRejectedValue(new Error('Trash unavailable'));
    await f.studio.deleteRequest(await f.studio.previewRequestDeletion(f.idea.id));
    const journal = f.storage.dataPath.replace('coforge-state.json', 'coforge-request-deletion.json');
    const original = f.kit.read(journal);
    await expect(f.studio.deleteRequest(await f.studio.previewRequestDeletion(other.id))).rejects.toThrow(/previous|recovery/i);
    expect(f.kit.read(journal)).toBe(original); expect(f.app.vault.getFileByPath(otherPath)).not.toBeNull();
    expect(f.studio.state().deletedRequests).toHaveLength(1);
  } finally { vi.restoreAllMocks(); await f.studio.stop(); }
});

it('keeps valid legacy increment data readable after deletion', async () => {
  const f = await atomicExistingFixture();
  try {
    await f.studio.store.transaction(state => { state.ideas[0]!.increment = { ...sampleIncrement('Legacy result', f.idea.createdAt), summary: '' }; });
    await f.studio.deleteRequest(await f.studio.previewRequestDeletion(f.idea.id));
    expect((await f.storage.load()).data?.deletedRequests?.at(-1)?.increment?.summary).toBe('');
  } finally { await f.studio.stop(); }
});
