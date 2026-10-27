import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../../features/coforge/domain/commands';
import { ingestChat } from '../../../features/coforge/application/chat';
import { emptyStore as rawEmptyStore, registerTestViewers } from './memory-storage';

describe('project-addressed bug reports', () => {
  it('requires a project and stores bugs separately from feature requests with the same text', async () => {
    expect(parseCommand('!bug cfp-001 The gate crashes the game')).toEqual({ type: 'bug', projectId: 'CFP-001', text: 'The gate crashes the game' });
    expect(parseCommand('!bug The gate crashes').type).toBe('invalid');
    const { store } = await emptyStore();
    await ingestChat(store, { username: 'A', text: '!request CFP-001 The gate crashes the game' });
    await ingestChat(store, { username: 'B', text: '!bug CFP-001 The gate crashes the game' });
    expect(store.snapshot().ideas).toHaveLength(2);
    expect(store.snapshot().ideas[1]).toMatchObject({ projectId: 'CFP-001', requestKind: 'bug', status: 'inbox' });
  });

  it('queues one durable bot acknowledgement in the same commit as the request', async () => {
    const { store, storage } = await emptyStore();
    await store.transaction(state => { state.integration.twitchEnabled = true; state.integration.twitchBotReplies = true; state.integration.twitchBroadcasterId = '123'; state.integration.twitchBotUserId = '456'; });
    const command = { source: 'twitch' as const, userId: '99', username: 'Viewer', messageId: 'event-1', text: '!bug CFP-001 The gate crashes the game' };
    await ingestChat(store, command);
    await ingestChat(store, command);
    expect(store.snapshot().ideas).toHaveLength(1);
    expect(store.snapshot().botReplies).toHaveLength(1);
    expect((await storage.load()).data?.botReplies?.[0]).toMatchObject({ parentMessageId: 'event-1', channelId: '123', status: 'pending' });
  });
});

async function emptyStore() {
  const fixture = await rawEmptyStore();
  await registerTestViewers(fixture.store, [{ username: 'A' }, { username: 'B' }, { username: 'Viewer', userId: '99', source: 'twitch' }]);
  return fixture;
}
