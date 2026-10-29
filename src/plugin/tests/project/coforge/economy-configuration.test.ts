import { expect, it } from 'vitest';
import { ensureEconomyState } from '../../../features/coforge/application/economy-configuration';
import { workflowUiFixture } from './workflow-ui-fixture';

it('reads legacy defaults without writes and saves zero fees, premium replacement and base earning atomically', async () => {
  const fixture = await workflowUiFixture();
  try {
    const writes = fixture.storage.saves; const snapshot = fixture.studio.getEconomy();
    expect(fixture.storage.saves).toBe(writes); expect(fixture.studio.state().population?.economy).toBeUndefined();
    expect(Object.values(snapshot.definition.commandRules).every(rule => rule.cost === 0)).toBe(true);
    snapshot.definition.premiumCurrencyPerMinute = 0;
    await fixture.studio.saveEconomyConfiguration({ definition: snapshot.definition, coinsPerMinute: 3 }, snapshot.configurationIdentity);
    expect(fixture.studio.getEconomy()).toMatchObject({ coinsPerMinute: 3, configurationRevision: 1, definition: { premiumCurrencyPerMinute: 0 } });
    expect(fixture.storage.saves).toBe(writes + 1);
    expect((await fixture.storage.load()).data?.population?.economy?.definition.premiumCurrencyPerMinute).toBe(0);
  } finally { await fixture.dispose(); }
});
it('keeps failed and stale configuration writes out of canonical data and publishes only committed facts', async () => {
  const fixture = await workflowUiFixture();
  try {
    const original = fixture.studio.getEconomy(); original.definition.commandRules.help.cost = 2;
    const events: string[] = []; const stop = fixture.studio.onEvent(event => { events.push(event.type); });
    fixture.storage.failNextSave = true;
    await expect(fixture.studio.saveEconomyConfiguration({ definition: original.definition, coinsPerMinute: 1 }, original.configurationIdentity)).rejects.toThrow('Disk full');
    expect(fixture.studio.state().population?.economy).toBeUndefined(); expect(events).toEqual([]);
    await fixture.studio.updateEconomyRules({ ...fixture.studio.state().population!.rules, coinsPerMinute: 4 });
    const writes = fixture.storage.saves;
    await expect(fixture.studio.saveEconomyConfiguration({ definition: original.definition, coinsPerMinute: 1 }, original.configurationIdentity)).rejects.toThrow('changed elsewhere');
    expect(fixture.storage.saves).toBe(writes); expect(fixture.studio.getEconomy().coinsPerMinute).toBe(4); stop();
  } finally { await fixture.dispose(); }
});
it('keeps fulfillment history independent of current catalog and uses exact revisions without granting twice', async () => {
  const fixture = await workflowUiFixture();
  try {
    const identity = fixture.studio.getEconomy().configurationIdentity;
    await fixture.studio.store.transaction(state => { ensureEconomyState(state).redemptions.push({ id: 'perk-one', usageId: 'usage-one', playerId: 'twitch:81', rewardId: 'removed-catalog-reward', rewardName: 'Captured manual perk', description: 'Deliver the captured item manually.', acquisition: 'reward-purchase', createdAt: new Date().toISOString(), status: 'pending', revision: 1 }); });
    expect(fixture.studio.getEconomy().configurationIdentity).toBe(identity);
    const players = fixture.studio.state().population?.players;
    await fixture.studio.fulfillEconomyPerk('perk-one', 1, 'Delivered in the stream.');
    expect(fixture.studio.getEconomy().redemptions[0]).toMatchObject({ status: 'fulfilled', revision: 2, rewardName: 'Captured manual perk', fulfillmentNote: 'Delivered in the stream.' });
    expect(fixture.studio.getEconomy().configurationIdentity).toBe(identity);
    const writes = fixture.storage.saves;
    await expect(fixture.studio.fulfillEconomyPerk('perk-one', 1, 'Do not repeat.')).rejects.toThrow('changed');
    expect(fixture.storage.saves).toBe(writes); expect(fixture.studio.state().population?.players).toEqual(players);
  } finally { await fixture.dispose(); }
});
