// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { expect, it } from 'vitest';
import CommunitySettingsView from '../../../presentation/components/coforge/CommunitySettingsView.vue';
import EconomyView from '../../../presentation/components/coforge/EconomyView.vue';
import { useEconomyStore } from '../../../presentation/stores/coforge-economy';
import { ensureEconomyState } from '../../../features/coforge/application/economy-configuration';
import { workflowUiFixture } from './workflow-ui-fixture';

async function click(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().trim() === text);
  if (!button) throw new Error(`Missing action ${text}`);
  await button.trigger('click'); await flushPromises();
}
it('keeps priced command drafts and blocks navigation until explicit save or discard, preserving failed saves', async () => {
  const fixture = await workflowUiFixture(); fixture.store.view = 'economy';
  const wrapper = mount(EconomyView, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    await flushPromises(); const writes = fixture.storage.saves;
    await wrapper.get('input[aria-label="Command fee"]').setValue('2');
    await click(wrapper, 'Earning');
    await wrapper.get('input[aria-label="Base currency per credited minute"]').setValue('3');
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('input[aria-label="Subscriber total per credited minute"]').setValue('5'); await flushPromises();
    expect(fixture.store.navigate('board')).toBe(false);
    expect(fixture.store.view).toBe('economy');
    fixture.storage.failNextSave = true;
    await wrapper.get('form[aria-label="Economy configuration"]').trigger('submit'); await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Disk full');
    expect(wrapper.get('input[aria-label="Base currency per credited minute"]').element).toHaveProperty('value', '3');
    expect(fixture.studio.getEconomy().coinsPerMinute).toBe(1);
    expect(fixture.storage.saves).toBe(writes);
    await wrapper.get('form[aria-label="Economy configuration"]').trigger('submit'); await flushPromises();
    expect(fixture.studio.getEconomy()).toMatchObject({ coinsPerMinute: 3, definition: { premiumCurrencyPerMinute: 5, commandRules: { help: { cost: 2 } } } });
    expect(fixture.store.dirtyEconomy).toBe(false); expect(fixture.store.navigate('board')).toBe(true);
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
it('authors virtual/manual rewards and weighted boxes without buying, opening or fulfilling them', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(EconomyView, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    await flushPromises(); await click(wrapper, 'Rewards'); await click(wrapper, 'Add virtual reward');
    await wrapper.get('input[aria-label="Reward name"]').setValue('Coin bundle');
    await wrapper.get('input[aria-label="Reward currency granted"]').setValue('7');
    await wrapper.get('input[aria-label="Reward purchase price"]').setValue('5');
    await click(wrapper, 'Add manual perk');
    await wrapper.get('input[aria-label="Reward name"]').setValue('Choose the next map');
    await wrapper.get('textarea[aria-label="Manual perk instructions"]').setValue('The streamer applies the choice manually.');
    const perk = useEconomyStore(fixture.pinia).draft.definition.rewards.find(reward => reward.kind === 'perk')!;
    await click(wrapper, 'Loot boxes'); await click(wrapper, 'Add loot box');
    await wrapper.get('input[aria-label="Loot box name"]').setValue('Camp chest');
    await click(wrapper, 'Add outcome'); await click(wrapper, 'Add outcome');
    await wrapper.get('select[aria-label="Outcome reward 2"]').setValue(perk.id);
    await wrapper.get('input[aria-label="Outcome weight 2"]').setValue('3');
    expect(wrapper.get('[aria-label="Selected loot box"]').text()).toContain('25.00%');
    expect(wrapper.get('[aria-label="Selected loot box"]').text()).toContain('75.00%');
    await wrapper.get('form[aria-label="Economy configuration"]').trigger('submit'); await flushPromises();
    expect(fixture.studio.getEconomy().definition.lootboxes[0]?.entries.map(entry => entry.weight)).toEqual([1, 3]);
    expect(fixture.studio.getEconomy().usages).toEqual([]); expect(fixture.studio.getEconomy().redemptions).toEqual([]);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
it('keeps manual fulfillment notes on failure and records captured perks without changing balances', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.transaction(state => { ensureEconomyState(state).redemptions.push({ id: 'perk-one', usageId: 'usage-one', playerId: 'twitch:81', rewardId: 'historic', rewardName: 'Captured perk', description: 'Deliver this manually.', acquisition: 'lootbox', createdAt: new Date().toISOString(), status: 'pending', revision: 1 }); });
  const wrapper = mount(EconomyView, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    await flushPromises(); await click(wrapper, 'Fulfillment'); await click(wrapper, 'Record fulfillment');
    await wrapper.get('textarea[aria-label="Private fulfillment note"]').setValue('Delivered live.');
    fixture.storage.failNextSave = true;
    await wrapper.get('form[aria-label="Record manual fulfillment"]').trigger('submit'); await flushPromises();
    expect(wrapper.get('textarea[aria-label="Private fulfillment note"]').element).toHaveProperty('value', 'Delivered live.');
    expect(fixture.studio.getEconomy().redemptions[0]?.status).toBe('pending');
    await wrapper.get('form[aria-label="Record manual fulfillment"]').trigger('submit'); await flushPromises();
    expect(fixture.studio.getEconomy().redemptions[0]).toMatchObject({ status: 'fulfilled', fulfillmentNote: 'Delivered live.' });
    expect(fixture.runner).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('saves filtered and remapped reactive catalogs and combines duplicate reward odds', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(EconomyView, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    await flushPromises(); await click(wrapper, 'Rewards');
    for (const name of ['Retained reward', 'Removed reward']) { await click(wrapper, 'Add virtual reward'); await wrapper.get('input[aria-label="Reward name"]').setValue(name); }
    await click(wrapper, 'Remove reward from draft');
    await wrapper.get('select[aria-label="Reward type"]').setValue('perk');
    await wrapper.get('textarea[aria-label="Manual perk instructions"]').setValue('Retained captured instructions.');
    await click(wrapper, 'Loot boxes');
    for (const name of ['Retained box', 'Removed box']) { await click(wrapper, 'Add loot box'); await wrapper.get('input[aria-label="Loot box name"]').setValue(name); await click(wrapper, 'Add outcome'); }
    await click(wrapper, 'Remove loot box from draft'); await click(wrapper, 'Add outcome');
    await wrapper.get('input[aria-label="Outcome weight 2"]').setValue('3');
    expect(wrapper.get('[aria-label="Selected loot box"]').text()).toMatch(/100[.]00% reward chance.*weight 4\/4.*this entry 1\/4/u);
    await wrapper.get('form[aria-label="Economy configuration"]').trigger('submit'); await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    const snapshot = fixture.studio.getEconomy();
    expect(snapshot.definition.rewards).toMatchObject([{ name: 'Retained reward', kind: 'perk', description: 'Retained captured instructions.' }]);
    expect(snapshot.definition.lootboxes).toMatchObject([{ name: 'Retained box', entries: [{ weight: 1 }, { weight: 3 }] }]);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('keeps currency earning in Economy when an older Community naming draft saves', async () => {
  const fixture = await workflowUiFixture();
  const wrapper = mount(CommunitySettingsView, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    await flushPromises();
    expect(wrapper.text()).not.toContain('gold per chat-presence minute');
    await wrapper.get('input[type="text"]').setValue('Community member');
    const current = fixture.studio.getEconomy();
    await fixture.studio.saveEconomyConfiguration({ definition: current.definition, coinsPerMinute: 8 }, current.configurationIdentity);
    await wrapper.get('form').trigger('submit'); await flushPromises();
    expect(fixture.studio.getEconomy().coinsPerMinute).toBe(8);
    expect(fixture.studio.state().population?.environment.actorName).toBe('Community member');
    await click(wrapper, 'Open Economy');
    expect(fixture.store.view).toBe('economy');
  } finally { wrapper.unmount(); await fixture.dispose(); }
});

it('preserves an edited fulfillment note and captured revision when queue actions are repeated or switched', async () => {
  const fixture = await workflowUiFixture();
  await fixture.studio.store.transaction(state => {
    for (const id of ['one', 'two']) ensureEconomyState(state).redemptions.push({ id, usageId: `usage-${id}`, playerId: 'twitch:81', rewardId: id, rewardName: `Perk ${id}`, description: 'Deliver manually.', acquisition: 'command-bonus', createdAt: new Date().toISOString(), status: 'pending', revision: 1 });
  });
  const wrapper = mount(EconomyView, { global: { plugins: [fixture.pinia, fixture.provider] } });
  try {
    await flushPromises(); await click(wrapper, 'Fulfillment');
    const queue = wrapper.get('.cf-economy-queue');
    await queue.findAll('button')[0]!.trigger('click');
    const store = useEconomyStore(fixture.pinia); const id = store.redemptionId; const revision = store.redemptionRevision;
    await wrapper.get('textarea[aria-label="Private fulfillment note"]').setValue('Keep this delivery evidence.');
    await queue.findAll('button')[0]!.trigger('click');
    expect(store.fulfillmentNote).toBe('Keep this delivery evidence.');
    await queue.findAll('button')[1]!.trigger('click');
    expect(store.redemptionId).toBe(id); expect(store.redemptionRevision).toBe(revision);
    expect(store.fulfillmentNote).toBe('Keep this delivery evidence.');
    expect(wrapper.get('[role="alert"]').text()).toContain('Record or cancel');
    await click(wrapper, 'Cancel fulfillment note');
    await queue.findAll('button')[1]!.trigger('click');
    expect(store.redemptionId).not.toBe(id); expect(store.fulfillmentNote).toBe('');
    expect(fixture.studio.getEconomy().redemptions.every(item => item.status === 'pending')).toBe(true);
  } finally { wrapper.unmount(); await fixture.dispose(); }
});
