import { describe, expect } from 'vitest';
import { expect as browserExpect } from '@playwright/test';
import { test } from './support/obsidian-fixture.ts';

describe('Twitch operations in contained Obsidian', () => {
  test('opens private channel tools, retains drafts and reconnects the view after plugin reload', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: 'Twitch operations', exact: true }).click();
    await browserExpect(view.getByRole('heading', { name: 'Twitch operations', exact: true })).toBeVisible();
    await view.locator('[data-twitch-page="engagement"]').click();
    await view.getByLabel('Reward title', { exact: false }).fill('Contained test reward');
    await view.getByLabel('Channel Points cost', { exact: false }).fill('500');
    await view.locator('[data-twitch-page="activity"]').click();
    await view.locator('[data-twitch-page="engagement"]').click();
    await browserExpect(view.getByLabel('Reward title', { exact: false })).toHaveValue('Contained test reward');
    await browserExpect(view.getByRole('button', { name: 'Review action', exact: true })).toBeDisabled();
    await view.locator('[data-twitch-page="data"]').click();
    await browserExpect(view.getByRole('heading', { name: 'Data & access', exact: true })).toBeVisible();
    await browserExpect(view.getByRole('region', { name: 'Dataset access and freshness', exact: true })).toBeVisible();
    await obsidian.screenshot('twitch-operations-data');
    await obsidian.reloadPlugin();
    const reopened = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await reopened.getByRole('button', { name: 'Twitch operations', exact: true }).click();
    await browserExpect(reopened.getByRole('heading', { name: 'Twitch operations', exact: true })).toBeVisible();
    expect(obsidian.errors()).toEqual([]);
  });
});
