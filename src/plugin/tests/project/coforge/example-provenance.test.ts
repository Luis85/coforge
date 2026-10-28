import { expect, it } from 'vitest';
import { parsePersistedStudio } from '../../../features/coforge/domain/persisted';
import { streamSurfaceSnapshot } from '../../../features/coforge/domain/stream-surfaces';
import { workflowUiFixture } from './workflow-ui-fixture';
import { assemble } from '../../../features/coforge/application/studio-state';

it('persists entrypoint origins and keeps manual provenance independent of simulator transport and demo agents', async () => {
  const fixture = await workflowUiFixture();
  try {
    await fixture.studio.loadSample();
    const samples = fixture.studio.state().ideas.map(idea => idea.id);
    await fixture.studio.createIdea({ title: 'Real manually authored feature', description: 'My authored feature remains real.', category: 'Gameplay', username: 'Owner', origin: 'sample' });
    const manual = fixture.studio.state().ideas.at(-1)!;
    expect(fixture.studio.state().requestOrigins?.[manual.id]).toBe('manual');
    expect(samples.every(id => fixture.studio.state().requestOrigins?.[id] === 'sample')).toBe(true);
    await fixture.studio.sendChat('Tester', '!register');
    const local = await fixture.studio.sendChat('Tester', `!request ${fixture.project.id} Local simulator test idea`);
    expect(fixture.studio.state().requestOrigins?.[local.ideaId!]).toBe('local-test');
    const loaded = await fixture.storage.load();
    const persisted = parsePersistedStudio(loaded.data);
    expect(persisted.requestOrigins).toEqual(fixture.studio.state().requestOrigins);
    expect(parsePersistedStudio({ ...loaded.data, exampleRemovalCutoffs: { [manual.id]: '2026-10-28T12:00:00Z' } }).exampleRemovalCutoffs).toEqual({ [manual.id]: '2026-10-28T12:00:00Z' });
    expect(() => parsePersistedStudio({ ...loaded.data, exampleRemovalCutoffs: { [manual.id]: 'not-a-date' } })).toThrow();
    expect(() => parsePersistedStudio({ ...loaded.data, exampleRemovalCutoffs: { invalid: '2026-10-28T12:00:00Z' } })).toThrow();
    expect(() => parsePersistedStudio({ ...loaded.data, requestOrigins: { [manual.id]: 'demo' } })).toThrow();
    expect(() => parsePersistedStudio({ ...loaded.data, requestOrigins: { 'not-an-idea': 'sample' } })).toThrow();
    const pruned = assemble({ ...loaded, notes: loaded.notes.filter(note => note.id !== manual.id) });
    expect(pruned.requestOrigins).not.toHaveProperty(manual.id);
    const publicSnapshot = streamSurfaceSnapshot(fixture.studio.store.internalSnapshot(), { channelId: '', liveSince: 0 });
    expect(publicSnapshot).not.toHaveProperty('requestOrigins');
    expect(JSON.stringify(publicSnapshot)).not.toContain('local-test');
  } finally { await fixture.dispose(); }
});
