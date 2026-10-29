import { afterEach, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { LivePopulationTracker } from '../../../features/coforge/application/live-population';
import { defaultEconomyDefinition } from '../../../features/coforge/domain/command-economy';
import type { TwitchState } from '../../../features/coforge/domain/twitch';
import { MemoryStorage, nodeTimers } from './memory-storage';

const stops: Array<() => Promise<void>> = [];
afterEach(async () => { for (const stop of stops.splice(0)) await stop(); vi.useRealTimers(); });
async function fixture() {
  vi.useFakeTimers(); vi.setSystemTime('2026-10-28T10:00:00Z');
  const timers = nodeTimers();
  const studio = new StudioService(new MemoryStorage(), { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  await studio.start(); await studio.updateIntegration({ twitchBroadcasterId: '123' });
  await studio.store.transaction(state => {
    state.population.economy = { configurationRevision: 0, definition: { ...defaultEconomyDefinition(), premiumCurrencyPerMinute: 4 }, usages: [], usageTombstones: {}, redemptions: [], droppedUsages: 0 };
  });
  const control = { fail: false, banned: false, live: true };
  const subscriptions = vi.fn(async () => { if (control.fail) throw new Error('Unavailable'); return ['91']; });
  const restrictions = vi.fn(async () => control.banned ? [{ userId: '91' }] : []);
  let tracking: TwitchState['tracking'];
  const tracker = new LivePopulationTracker(studio, {
    liveStream: async () => control.live ? { id: 'stream-1', startedAt: '2026-10-28T09:00:00Z' } : null,
    chatters: async () => ['twitch:91', 'twitch:92'],
    chattersProfiles: async () => [{ id: 'twitch:91', name: 'Subscriber' }, { id: 'twitch:92', name: 'Viewer' }],
    subscriptions, restrictions,
  }, timers, () => studio.integration(), () => true, state => { tracking = state; });
  stops.push(async () => { tracker.stop(); await studio.stop(); });
  tracker.start(); await vi.advanceTimersByTimeAsync(0);
  return { studio, tracker, control, subscriptions, restrictions, tracking: () => tracking };
}
it('funds observed unregistered viewers, replacing base with verified subscriber income and granting no XP', async () => {
  const f = await fixture();
  await vi.advanceTimersByTimeAsync(60000);
  const players = f.studio.state().population!.players;
  expect(players.find(player => player.id === 'twitch:91')).toMatchObject({ coins: 4, xp: 0, presenceSeconds: 60 });
  expect(players.find(player => player.id === 'twitch:92')).toMatchObject({ coins: 1, xp: 0, presenceSeconds: 60 });
  expect(players.every(player => !player.registeredAt)).toBe(true);
  expect(f.restrictions.mock.calls).toHaveLength(2);
  expect(f.tracking()?.message).toContain('Subscriber');
});
it('uses base income honestly when fresh subscriber verification fails and never backfills offline time', async () => {
  const f = await fixture();
  await vi.advanceTimersByTimeAsync(60000);
  f.control.fail = true;
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.studio.state().population!.players.find(player => player.id === 'twitch:91')?.coins).toBe(5);
  expect(f.tracking()?.message).toContain('base');
  f.control.live = false; await vi.advanceTimersByTimeAsync(180000);
  expect(f.studio.state().population!.players.find(player => player.id === 'twitch:91')?.coins).toBe(5);
});
it('checks restrictions for unregistered viewers before paying their next interval', async () => {
  const f = await fixture(); f.control.banned = true;
  await vi.advanceTimersByTimeAsync(60000);
  expect(f.studio.state().population!.players.find(player => player.id === 'twitch:91')).toMatchObject({ coins: 0, restriction: { banned: true, channelId: '123' } });
  expect(f.studio.state().population!.players.find(player => player.id === 'twitch:92')?.coins).toBe(1);
});
