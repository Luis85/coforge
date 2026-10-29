import { expect, it } from 'vitest';
import { PresenceSubscriptionCache } from '../../../features/coforge/application/presence-subscriptions';
import { presenceRestrictions } from '../../../features/coforge/application/presence-restrictions';

it('bounds subscriber and restriction read concurrency to four while retaining all selected evidence', async () => {
  const players = Array.from({ length: 1001 }, (_, index) => `twitch:${index + 1}`);
  let active = 0; let peak = 0; let calls = 0;
  const lookup = async (ids: readonly string[]) => {
    active++; peak = Math.max(peak, active); calls++;
    expect(ids.length).toBeLessThanOrEqual(100);
    await Promise.resolve(); active--; return [...ids];
  };
  const cache = new PresenceSubscriptionCache({ subscriptions: lookup });
  expect((await cache.read('123', players, () => true))?.playerIds).toEqual(players);
  expect(peak).toBe(4); expect(calls).toBe(11);
  active = 0; peak = 0; calls = 0;
  const restricted = await presenceRestrictions({ restrictions: async ids => (await lookup(ids)).map(userId => ({ userId })) }, players, () => true);
  expect(restricted.map(item => `twitch:${item.userId}`)).toEqual(players);
  expect(peak).toBe(4); expect(calls).toBe(11);
});

it('never exposes a partial restriction snapshot when a batch fails or the connection becomes stale', async () => {
  const players = Array.from({ length: 101 }, (_, index) => `twitch:${index + 1}`);
  await expect(presenceRestrictions({ restrictions: async ids => { if (ids[0] === '101') throw new Error('Unavailable'); return ids.map(userId => ({ userId })); } }, players, () => true)).rejects.toThrow('Unavailable');
  let current = true;
  expect(await presenceRestrictions({ restrictions: async ids => { current = false; return ids.map(userId => ({ userId })); } }, players, () => current)).toEqual([]);
});
