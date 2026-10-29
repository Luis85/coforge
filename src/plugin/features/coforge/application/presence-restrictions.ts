import type { ChannelRestriction, LivePresencePort } from './integration-ports';

/** Bound independent read concurrency for large observed chat populations. No partial snapshot is authoritative. */
export async function presenceRestrictions(api: Pick<LivePresencePort, 'restrictions'>, users: readonly string[], current: () => boolean): Promise<ChannelRestriction[]> {
  const result: ChannelRestriction[] = [];
  for (let offset = 0; offset < users.length; offset += 400) {
    if (!current()) return [];
    const lookups: Array<Promise<ChannelRestriction[]>> = [];
    for (let start = offset; start < Math.min(offset + 400, users.length); start += 100)
      lookups.push(api.restrictions(users.slice(start, start + 100).map(id => id.slice(7))));
    const settled = await Promise.allSettled(lookups);
    if (!current()) return [];
    for (const item of settled) {
      if (item.status === 'rejected') throw item.reason;
      result.push(...item.value);
    }
  }
  return result;
}
