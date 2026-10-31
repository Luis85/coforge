import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('Sidepanel preferences in the contained host', () => {
  test('restores navigation and chat choices after reload, including expanded chat on a narrow leaf', async ({ obsidian }) => {
    await obsidian.eval(() => localStorage.removeItem('coforge:ui:sidepanels:v1'));
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Sidepanel preferences');
    await view.getByLabel(/^Project path/).fill('/synthetic/sidepanel-preferences');
    await view.getByLabel('Description', { exact: true }).fill('Local panel preferences without changing project configuration.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Sidepanel preferences');
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    const expandChat = view.getByRole('button', { name: 'Expand chat panel', exact: true });
    if (await expandChat.isVisible()) await expandChat.click();
    await view.getByRole('button', { name: 'Collapse chat panel', exact: true }).click();
    await view.getByRole('button', { name: 'Collapse navigation panel', exact: true }).click();
    await browserExpect(view.locator('.cf-sidebar')).toBeHidden();
    await browserExpect(view.locator('.cf-chat-panel')).toBeHidden();
    expect(await obsidian.eval(() => JSON.parse(localStorage.getItem('coforge:ui:sidepanels:v1') ?? 'null'))).toEqual({ navigation: true, chat: true });

    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await browserExpect(view.getByRole('button', { name: 'Expand navigation panel', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await view.getByRole('button', { name: 'Expand navigation panel', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await browserExpect(view.getByRole('button', { name: 'Expand chat panel', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await view.getByRole('button', { name: 'Expand chat panel', exact: true }).click();
    await view.getByRole('button', { name: 'Collapse navigation panel', exact: true }).click();
    expect(await obsidian.eval(() => JSON.parse(localStorage.getItem('coforge:ui:sidepanels:v1') ?? 'null'))).toEqual({ navigation: true, chat: false });

    await obsidian.page.setViewportSize({ width: 1000, height: 900 });
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await browserExpect(view.getByRole('button', { name: 'Expand navigation panel', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await view.getByRole('button', { name: 'Expand navigation panel', exact: true }).click();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.getByRole('button', { name: 'Collapse navigation panel', exact: true }).click();
    await browserExpect(view.getByRole('button', { name: 'Collapse chat panel', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await browserExpect(view.locator('.cf-chat-panel')).toBeVisible();
    expect(await view.locator('.cf-studio').evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(1050);
    await obsidian.screenshot('sidepanels-restored-expanded-chat-narrow');
    expect(obsidian.errors()).toEqual([]);
  });
});
