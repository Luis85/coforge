import { describe, expect, it } from 'vitest';
import { ingestChat } from '../../../features/coforge/application/chat';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { identity, parseCommand } from '../../../features/coforge/domain/commands';
import { emptyStore as rawEmptyStore, registerTestViewers } from './memory-storage';

describe('chat commands and vote identity', () => {
  it('parses case-insensitive commands and normalized stable IDs', () => {
    expect(parseCommand(' !REQUEST cfp-001 Add a garden ')).toEqual({ type: 'request', projectId: 'CFP-001', text: 'Add a garden' });
    expect(parseCommand('!vote $cf-001')).toEqual({ type: 'vote', ideaId: 'CF-001' });
    expect(parseCommand('!vote 101')).toEqual({ type: 'vote', ideaId: 'CF-101' });
    expect(parseCommand('!vote CF-101 CF-102').type).toBe('invalid');
    expect(parseCommand('!request CFP-001   ').type).toBe('invalid');
    expect(parseCommand('!status CF-101')).toEqual({ type: 'status', ideaId: 'CF-101' });
    expect(parseCommand('!me')).toEqual({ type: 'me' });
    expect(parseCommand('hello chat')).toEqual({ type: 'message' });
  });

  it('persists stable IDs and deduplicates redelivered platform messages across a restart', async () => {
    const { store, storage } = await emptyStore();
    const input = { username: 'River', userId: 'twitch:123', text: '!request CFP-001 Add a garden', source: 'twitch' as const, messageId: 'event-1' };
    expect(await ingestChat(store, input)).toMatchObject({ ok: true, ideaId: 'CF-001' });
    expect(await ingestChat(store, input)).toMatchObject({ ok: true, duplicate: true, ideaId: 'CF-001' });
    const reloaded = new StudioStore(storage);
    await reloaded.init();
    expect(await ingestChat(reloaded, input)).toMatchObject({ duplicate: true });
    expect(reloaded.snapshot().ideas).toHaveLength(1);
    expect(reloaded.snapshot().ideas[0]?.authorId).toBe('twitch:123');
    expect(reloaded.snapshot().nextIdeaNumber).toBe(2);
  });

  it('keeps one vote per provider identity despite display-name changes', async () => {
    const { store } = await emptyStore();
    await ingestChat(store, { username: 'Maker', text: '!request CFP-001 Add a garden' });
    await ingestChat(store, { username: 'Alice', userId: '42', source: 'twitch', text: '!vote 1' });
    expect(await ingestChat(store, { username: 'RenamedAlice', userId: 'twitch:42', source: 'twitch', text: '!vote CF-001' })).toMatchObject({ duplicate: true });
    expect(store.snapshot().ideas[0]?.voters).toEqual(['twitch:42']);
    expect(identity({ username: 'STREAMER', source: 'simulator' })).toBe('simulator:streamer');
  });

  it('serializes concurrent votes without lost updates or duplicate votes', async () => {
    const { store } = await emptyStore();
    await ingestChat(store, { username: 'Maker', text: '!request CFP-001 Add a garden' });
    await Promise.all(Array.from({ length: 20 }, (_, i) => ingestChat(store, { username: `Viewer ${i % 10}`, userId: String(i % 10), text: '!vote 1', source: 'api' })));
    expect(store.snapshot().ideas[0]?.voters).toHaveLength(10);
  });

  it('enforces request cooldown without consuming idea IDs and holds flagged voting', async () => {
    const { store } = await emptyStore();
    await ingestChat(store, { username: 'Maker', text: '!request CFP-001 Add a garden' });
    expect(await ingestChat(store, { username: 'Maker', text: '!request CFP-001 Add a waterfall' })).toMatchObject({ ok: false });
    expect(store.snapshot().nextIdeaNumber).toBe(2);
    await store.transaction(state => { state.ideas[0]!.status = 'flagged'; });
    expect(await ingestChat(store, { username: 'Friend', text: '!vote 1' })).toMatchObject({ ok: false });
    expect(store.snapshot().ideas[0]?.voters).toHaveLength(0);
  });

  it('answers status and contribution commands with local acknowledgements', async () => {
    const { store } = await emptyStore();
    await ingestChat(store, { username: 'Maker', text: '!request CFP-001 Add a garden' });
    const status = await ingestChat(store, { username: 'Maker', text: '!status 1' });
    expect(status.message).toContain('CF-001');
    expect(status.message).toContain('inbox');
    const profile = await ingestChat(store, { username: 'Maker', text: '!me' });
    expect(profile.message).toContain('0 screened ideas');
    expect(profile.message).toContain('0 badges');
    expect(store.snapshot().chat.filter(m => m.userId === 'system:coforge')).toHaveLength(3);
  });

  it('leaves the committed state unchanged when a write fails', async () => {
    const { store, storage } = await emptyStore();
    storage.failNextSave = true;
    await expect(ingestChat(store, { username: 'Maker', text: '!request CFP-001 Add a garden' })).rejects.toThrow('Disk full');
    expect(store.snapshot().ideas).toHaveLength(0);
    expect(store.snapshot().nextIdeaNumber).toBe(1);
  });
});

async function emptyStore() {
  const fixture = await rawEmptyStore();
  await registerTestViewers(fixture.store, [{ username: 'Maker' }, { username: 'Friend' }, { username: 'River', userId: '123', source: 'twitch' }, { username: 'Alice', userId: '42', source: 'twitch' }, ...Array.from({ length: 10 }, (_, i) => ({ username: 'Viewer ' + i, userId: String(i), source: 'api' as const }))]);
  return fixture;
}
