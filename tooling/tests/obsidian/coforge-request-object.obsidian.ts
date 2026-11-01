import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { openProjectSettings } from '../../../tests/e2e/support/settings-navigation';

function body(text: string) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
}
describe('Project Request Object in the contained host', () => {
  test('persists project categories and captured values without rewriting existing schema or human note bytes', async ({ obsidian }) => {
    let view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Native Request Object');
    await view.getByLabel(/^Project path/).fill('/synthetic/request-object');
    await view.getByLabel('Description', { exact: true }).fill('A contained project with custom request categories and fields.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Native Request Object');
    await openProjectSettings(view, 'Requests');
    await view.getByLabel('Request note class', { exact: true }).fill('Business Idea');
    await view.getByLabel('Request categories', { exact: true }).fill('Strategy\nCommercial');
    await view.getByRole('button', { name: 'Add request field', exact: true }).click();
    await view.getByLabel('Field 1 label', { exact: true }).fill('Audience');
    await view.getByLabel('Field 1 property key', { exact: true }).fill('target_audience');
    await view.getByRole('button', { name: 'Save settings', exact: true }).click();
    await browserExpect(view.getByText('Settings saved', { exact: true })).toBeVisible();
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await view.getByRole('button', { name: 'New request', exact: true }).first().click();
    await view.getByLabel('The idea', { exact: true }).fill('Native business opportunity');
    await view.getByLabel('A little more context', { exact: true }).fill('The original request description remains canonical.');
    await view.getByLabel('Audience', { exact: true }).fill('Independent makers');
    await view.getByRole('button', { name: 'Add to the board', exact: true }).click();
    await browserExpect(view.getByRole('dialog', { name: 'New request', exact: true })).toHaveCount(0);
    await browserExpect(view.locator('.cf-idea-card').filter({ hasText: 'Native business opportunity' })).toBeVisible();
    const original = await obsidian.eval(async ({ app }) => {
      const file = app.vault.getMarkdownFiles().find(file => file.path.startsWith('CoForge/Ideas/'));
      if (!file) throw new Error('Expected a canonical request note.');
      await app.vault.process(file, text => text.replace(/^---\r?\n/, '---\nowner-property: "preserve this exact quoting"\n') + '\r\n## Human annotation\r\nKeep these **body bytes**.\r\n');
      return { path: file.path, text: await app.vault.read(file) };
    });
    expect(original.text).toContain('request-class: Business Idea');
    expect(original.text).toContain('target_audience: Independent makers');
    expect(original.text).toContain('coforge-request-schema:');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    const card = view.locator('.cf-idea-card').filter({ hasText: 'Native business opportunity' });
    await card.locator('.cf-idea-open').click();
    const fields = view.getByRole('region', { name: 'Captured request object', exact: true });
    await browserExpect(fields.getByRole('heading', { name: 'Business Idea', exact: true })).toBeVisible();
    await fields.getByLabel('Audience', { exact: true }).fill('Local makers');
    await fields.getByRole('button', { name: 'Save request fields', exact: true }).click();
    await browserExpect(fields.getByRole('button', { name: 'Save request fields', exact: true })).toBeDisabled();
    await browserExpect(fields.getByRole('status')).toContainText('Request fields saved.');
    const edited = await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), original.path);
    expect(body(edited)).toBe(body(original.text));
    expect(edited).toContain('owner-property: "preserve this exact quoting"');
    expect(edited).toContain('target_audience: Local makers');
    await view.getByRole('button', { name: 'Close idea details', exact: true }).click();
    await openProjectSettings(view, 'Requests');
    await view.getByLabel('Request note class', { exact: true }).fill('Feature Idea');
    await view.getByLabel('Request categories', { exact: true }).fill('Product');
    await view.getByRole('button', { name: 'Save settings', exact: true }).click();
    await browserExpect(view.getByText('Settings saved', { exact: true })).toBeVisible();
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), original.path)).toBe(edited);
    await obsidian.reloadPlugin();
    view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await openProjectSettings(view, 'Requests');
    await browserExpect(view.getByLabel('Request note class', { exact: true })).toHaveValue('Feature Idea');
    await browserExpect(view.getByLabel('Request categories', { exact: true })).toHaveValue('Product');
    await view.getByRole('button', { name: /^Idea board/ }).first().click();
    await card.locator('.cf-idea-open').click();
    await browserExpect(fields.getByRole('heading', { name: 'Business Idea', exact: true })).toBeVisible();
    await browserExpect(fields.getByLabel('Audience', { exact: true })).toHaveValue('Local makers');
    await browserExpect(view.getByRole('dialog', { name: 'Native business opportunity', exact: true }).locator('.cf-idea-category')).toHaveText('Strategy');
    const drawer = view.getByRole('dialog', { name: 'Native business opportunity', exact: true });
    await browserExpect(drawer).toHaveCSS('opacity', '1');
    const surface = await drawer.evaluate(element => {
      const style = getComputedStyle(element);
      const alpha = style.backgroundColor.startsWith('rgba(') ? Number(style.backgroundColor.split(',').at(-1)?.replace(')', '').trim()) : 1;
      return { opacity: style.opacity, background: style.backgroundColor, alpha };
    });
    expect(surface.opacity).toBe('1'); expect(surface.background).not.toBe('transparent'); expect(surface.alpha).toBe(1);
    const tabs = drawer.getByRole('navigation', { name: 'Idea sections', exact: true });
    await browserExpect(tabs.getByRole('button')).toHaveText(['Overview', 'Sessions', 'Plan & Design', 'Increment', 'Workflow runs', 'Activity']);
    await browserExpect(tabs).toHaveCSS('flex-direction', 'row'); await browserExpect(tabs).toHaveCSS('flex-wrap', 'wrap');
    const geometry = await tabs.evaluate(element => {
      const bounds = element.getBoundingClientRect(); const style = getComputedStyle(element);
      const buttons = [...element.querySelectorAll('button')].map(button => { const box = button.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, width: box.width, left: box.left, right: box.right }; });
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      return { width: bounds.width, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, contentWidth: bounds.width - padding, gap: Number.parseFloat(style.columnGap) || 0, basis: style.flexBasis, buttons, fits: element.scrollWidth <= element.clientWidth + 1 };
    });
    expect(geometry.buttons).toHaveLength(6); expect(geometry.basis).toBe('auto'); expect(geometry.fits).toBe(true);
    const neededWidth = geometry.buttons.reduce((sum, button) => sum + button.width, 0) + geometry.gap * (geometry.buttons.length - 1);
    if (neededWidth <= geometry.contentWidth + 1)
      expect(Math.max(...geometry.buttons.map(button => button.top)) - Math.min(...geometry.buttons.map(button => button.top))).toBeLessThan(1);
    const rows = geometry.buttons.reduce<Array<typeof geometry.buttons>>((groups, button) => {
      const row = groups.find(group => Math.abs(group[0]!.top - button.top) < 1);
      if (row) row.push(button); else groups.push([button]);
      return groups;
    }, []);
    for (const [index, row] of rows.entries()) {
      for (let button = 1; button < row.length; button++) expect(row[button]!.left - row[button - 1]!.right).toBeGreaterThanOrEqual(8);
      if (index) expect(row[0]!.top).toBeGreaterThanOrEqual(Math.max(...rows[index - 1]!.map(button => button.bottom)));
    }
    for (const button of geometry.buttons) { expect(button.width).toBeLessThan(geometry.width / 2); expect(button.left).toBeGreaterThanOrEqual(geometry.left); expect(button.right).toBeLessThanOrEqual(geometry.right + 1); expect(button.top).toBeGreaterThanOrEqual(geometry.top); expect(button.bottom).toBeLessThanOrEqual(geometry.bottom + 1); }
    expect(obsidian.errors()).toEqual([]);
    await obsidian.screenshot('request-object-captured-schema-and-human-note');
  });
});
