import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';

async function configureEconomy(page: Page, theme: string) {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await page.evaluate(value => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${value}`); }, theme);
  const sidebar = page.locator('.cf-sidebar');
  await sidebar.getByRole('button', { name: 'Economy', exact: true }).click();
  const view = page.locator('.cf-economy-page');
  const pages = view.getByRole('navigation', { name: 'Economy pages', exact: true });
  await expect(view.getByRole('heading', { level: 1, name: 'Economy', exact: true })).toHaveCount(1);
  expect(await view.locator('.cf-economy-config-fields').evaluate(element => element.clientWidth >= (element.parentElement?.clientWidth ?? 0) - 2)).toBe(true);
  await expect(view.getByRole('region', { name: 'Stream commands', exact: true }).getByRole('button')).toHaveCount(14);
  await view.getByLabel('Command currency bonus', { exact: true }).fill('10');
  await view.getByRole('region', { name: 'Stream commands', exact: true }).getByRole('button', { name: /!register/ }).click();
  await view.getByLabel('Command fee', { exact: true }).fill('2');
  await view.getByLabel('Command XP bonus', { exact: true }).fill('3');
  await sidebar.getByRole('button', { name: /^Idea board/ }).click();
  await expect(view).toBeVisible();
  await pages.getByRole('button', { name: 'Earning', exact: true }).click();
  await view.getByLabel('Base currency per credited minute', { exact: true }).fill('3');
  await view.getByLabel('Use a separate subscriber total rate', { exact: true }).check();
  await view.getByLabel('Subscriber total per credited minute', { exact: true }).fill('5');
  await pages.getByRole('button', { name: 'Rewards', exact: true }).click();
  await view.getByRole('button', { name: 'Add virtual reward', exact: true }).click();
  await view.getByLabel('Reward name', { exact: true }).fill('Camp supplies');
  await view.getByLabel('Reward purchase price', { exact: true }).fill('4');
  await view.getByLabel('Reward currency granted', { exact: true }).fill('6');
  await view.getByRole('button', { name: 'Add manual perk', exact: true }).click();
  await view.getByLabel('Reward name', { exact: true }).fill('Choose the next map');
  await view.getByLabel('Reward purchase price', { exact: true }).fill('3');
  await view.getByLabel('Manual perk instructions', { exact: true }).fill('The streamer applies the viewer’s choice manually.');
  const perkId = await view.getByRole('region', { name: 'Selected reward', exact: true }).locator('code').innerText();
  await pages.getByRole('button', { name: 'Loot boxes', exact: true }).click();
  await view.getByRole('button', { name: 'Add loot box', exact: true }).click();
  await view.getByLabel('Loot box name', { exact: true }).fill('Camp chest');
  await view.getByLabel('Loot box purchase price', { exact: true }).fill('2');
  await view.getByRole('button', { name: 'Add outcome', exact: true }).click();
  await view.getByRole('button', { name: 'Add outcome', exact: true }).click();
  await view.getByRole('combobox', { name: 'Outcome reward 2', exact: true }).selectOption(perkId);
  await view.getByLabel('Outcome weight 2', { exact: true }).fill('3');
  await expect(view.getByRole('region', { name: 'Selected loot box', exact: true })).toContainText('25.00% reward chance');
  await expect(view.getByRole('region', { name: 'Selected loot box', exact: true })).toContainText('75.00% reward chance');
  await view.getByRole('button', { name: 'Save Economy rules', exact: true }).click();
  await expect(view.getByRole('button', { name: 'Save Economy rules', exact: true })).toBeDisabled();
  return { view, pages, sidebar, perkId };
}

for (const theme of ['light', 'dark']) test(`Economy applies priced commands and records manual fulfillment in ${theme}`, async ({ page }) => {
  const { view, pages, sidebar, perkId } = await configureEconomy(page, theme);
  await sidebar.getByRole('button', { name: 'Stream chat', exact: true }).click();
  await page.getByRole('button', { name: 'Test commands locally', exact: true }).click();
  await page.getByLabel('Simulated viewer name', { exact: true }).fill('Economy browser viewer');
  for (const command of ['!help', '!register', `!redeem ${perkId}`]) {
    await page.getByLabel('Chat message', { exact: true }).fill(command);
    await page.getByRole('button', { name: 'Send chat message', exact: true }).click();
    await expect(page.getByLabel('Chat message', { exact: true })).toHaveValue('');
  }
  await sidebar.getByRole('button', { name: 'Economy', exact: true }).click();
  await pages.getByRole('button', { name: 'Fulfillment', exact: true }).click();
  await expect(view.getByRole('region', { name: 'Manual perk fulfillment queue', exact: true })).toContainText('1 pending');
  await view.getByRole('button', { name: /^Record fulfillment for/ }).click();
  await view.getByLabel('Private fulfillment note', { exact: true }).fill('Applied the viewer choice during the stream.');
  await mkdir('reports/economy', { recursive: true });
  for (const [id, label] of [['fulfillment', 'Fulfillment']]) {
    await pages.getByRole('button', { name: label, exact: true }).click();
    for (const width of [1280, 480]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await view.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.locator('.cf-studio').screenshot({ path: `reports/economy/${id}-${theme}-${width}.png` });
    }
    expect((await new AxeBuilder({ page }).include('.cf-economy-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
  await view.getByRole('button', { name: 'Record as fulfilled', exact: true }).click();
  await expect(view.getByRole('region', { name: 'Manual perk fulfillment queue', exact: true })).toContainText('0 pending');
  await view.getByRole('combobox', { name: 'Fulfillment status', exact: true }).selectOption('fulfilled');
  await expect(view).toContainText('Applied the viewer choice during the stream.');
});

for (const theme of ['light', 'dark']) test(`Economy catalogs and earning reflow with visible prices and odds in ${theme}`, async ({ page }) => {
  const { view, pages } = await configureEconomy(page, theme);
  await mkdir('reports/economy', { recursive: true });
  for (const [id, label] of [['commands', 'Command prices'], ['earning', 'Earning'], ['rewards', 'Rewards'], ['lootboxes', 'Loot boxes']]) {
    await pages.getByRole('button', { name: label, exact: true }).click();
    for (const width of [1280, 480]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await view.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.locator('.cf-studio').screenshot({ path: `reports/economy/${id}-${theme}-${width}.png` });
    }
    expect((await new AxeBuilder({ page }).include('.cf-economy-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
});
