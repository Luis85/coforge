import { expect, it, vi } from 'vitest';
import { PresenceSubscriptionCache } from '../../../features/coforge/application/presence-subscriptions';

it('batches complete evidence, caches positive and negative results and refreshes after 90 seconds', async () => {
  let now = 100000;
  const lookup = vi.fn(async (ids: readonly string[]) => ids.filter(id => Number(id) % 2 === 0));
  const cache = new PresenceSubscriptionCache({ subscriptions: lookup }, () => now);
  const players = Array.from({ length: 205 }, (_, index) => `twitch:${index + 1}`);
  const first = await cache.read('123', players, () => true);
  expect(lookup.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 5]);
  expect(first?.playerIds).toHaveLength(102); expect(first?.channelId).toBe('123');
  now += 60000;
  expect(await cache.read('123', players, () => true)).toEqual(first);
  expect(lookup).toHaveBeenCalledTimes(3);
  now += 31000;
  expect((await cache.read('123', players, () => true))?.checkedAt).toBe(new Date(now).toISOString());
  expect(lookup).toHaveBeenCalledTimes(6);
});

it('falls back without claiming subscriber evidence when unsupported, failed or incomplete', async () => {
  expect(await new PresenceSubscriptionCache({}).read('123', ['twitch:91'], () => true)).toBeUndefined();
  expect(await new PresenceSubscriptionCache({ subscriptions: async () => { throw new Error('Unavailable'); } }).read('123', ['twitch:91'], () => true)).toBeUndefined();
  expect(await new PresenceSubscriptionCache({ subscriptions: async () => ['99'] }).read('123', ['twitch:91'], () => true)).toBeUndefined();
});

it('does not retain evidence after reconnect, channel switch or a stale in-flight snapshot', async () => {
  const lookup = vi.fn(async () => ['91']);
  const cache = new PresenceSubscriptionCache({ subscriptions: lookup });
  await cache.read('123', ['twitch:91'], () => true);
  cache.reset();
  await cache.read('123', ['twitch:91'], () => true);
  await cache.read('456', ['twitch:91'], () => true);
  expect(lookup).toHaveBeenCalledTimes(3);
  let resolve!: (ids: string[]) => void;
  const waiting = new PresenceSubscriptionCache({ subscriptions: () => new Promise(done => { resolve = done; }) });
  const pending = waiting.read('123', ['twitch:91'], () => true);
  waiting.reset(); resolve(['91']);
  expect(await pending).toBeUndefined();
});

it('keeps no partial new cache after a later batch fails and checks current state after lookup', async () => {
  const lookup = vi.fn(async (ids: readonly string[]) => { if (ids[0] === '101') throw new Error('Last batch failed'); return [...ids]; });
  const cache = new PresenceSubscriptionCache({ subscriptions: lookup });
  expect(await cache.read('123', Array.from({ length: 101 }, (_, index) => `twitch:${index + 1}`), () => true)).toBeUndefined();
  await cache.read('123', ['twitch:1'], () => true);
  expect(lookup).toHaveBeenCalledTimes(3);
  let valid = true;
  const switched = new PresenceSubscriptionCache({ subscriptions: async () => { valid = false; return ['91']; } });
  expect(await switched.read('123', ['twitch:91'], () => valid)).toBeUndefined();
});
