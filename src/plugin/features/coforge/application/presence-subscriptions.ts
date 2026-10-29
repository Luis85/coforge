import type { LivePresencePort } from './integration-ports';

export interface VerifiedPresenceSubscribers { channelId: string; checkedAt: string; playerIds: string[] }
interface CachedSubscription { subscriber: boolean; checkedAt: number }
const FRESH_MS = 90000;

/** Private polling cache. A partial lookup never becomes a complete premium-income sample. */
export class PresenceSubscriptionCache {
  private channelId = '';
  private generation = 0;
  private cache = new Map<string, CachedSubscription>();
  constructor(private readonly api: Pick<LivePresencePort, 'subscriptions'>, private readonly now = () => Date.now()) {}
  reset(): void { this.generation++; this.channelId = ''; this.cache.clear(); }
  async read(channelId: string, playerIds: readonly string[], current: () => boolean): Promise<VerifiedPresenceSubscribers | undefined> {
    const lookup = this.api.subscriptions;
    if (!lookup || !current() || !/^\d+$/.test(channelId) || playerIds.some(id => !/^twitch:\d+$/.test(id))) return;
    if (this.channelId !== channelId) { this.reset(); this.channelId = channelId; }
    const generation = this.generation;
    const valid = () => current() && generation === this.generation && channelId === this.channelId;
    const at = this.now();
    const players = [...new Set(playerIds)];
    const wanted = new Set(players);
    const staged = new Map([...this.cache].filter(([id, value]) => wanted.has(id) && at - value.checkedAt >= 0 && at - value.checkedAt <= FRESH_MS));
    const missing = players.filter(id => !staged.has(id));
    try {
      for (let offset = 0; offset < missing.length; offset += 400) {
        if (!valid()) return;
        const batches: string[][] = [];
        for (let start = offset; start < Math.min(offset + 400, missing.length); start += 100)
          batches.push(missing.slice(start, start + 100).map(id => id.slice(7)));
        const results = await Promise.allSettled(batches.map(batch => lookup.call(this.api, batch)));
        if (!valid()) return;
        for (let index = 0; index < results.length; index++) {
          const result = results[index]!; const batch = batches[index]!;
          if (result.status === 'rejected' || result.value.some(id => !batch.includes(id)) || new Set(result.value).size !== result.value.length) return;
          const subscribers = new Set(result.value); const checkedAt = this.now();
          for (const id of batch) staged.set(`twitch:${id}`, { subscriber: subscribers.has(id), checkedAt });
        }
      }
      if (!valid()) return;
      const checkedAt = Math.min(this.now(), ...players.map(id => staged.get(id)!.checkedAt));
      if (this.now() - checkedAt > FRESH_MS || this.now() < checkedAt) return;
      this.cache = staged;
      return { channelId, checkedAt: new Date(checkedAt).toISOString(), playerIds: players.filter(id => staged.get(id)!.subscriber) };
    } catch { return; }
  }
}
