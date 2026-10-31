import { expect as browserExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { openWorkflowDisclosure, openWorkflowSettings } from '../../../tests/e2e/support/workflow-navigation';
import { defaultWorkflowDefinition } from '../../../src/plugin/features/coforge/domain/configured-workflow';
import { materializeWorkflowBuckets } from '../../../src/plugin/features/coforge/domain/workflow-buckets';
import { defaultSettings } from '../../../src/plugin/features/coforge/domain/seed';

describe('Bucket and step outline layout in native Obsidian', () => {
  test('keeps eight nested steps aligned, compact and keyboard reachable in both themes and pane sizes', async ({ obsidian }) => {
    const view = await obsidian.openView(`${obsidian.pluginId}-view-project-workbench`);
    await obsidian.eval(({ app }) => { app.workspace.leftSplit.collapse(); });
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Outline layout');
    await view.getByLabel(/^Project path/).fill('/synthetic/outline-layout');
    await view.getByLabel('Description', { exact: true }).fill('Contained UI geometry verification.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Outline layout');
    await openWorkflowSettings(view);
    const definition = materializeWorkflowBuckets(defaultWorkflowDefinition(defaultSettings()));
    definition.steps.find(step => step.id === 'plan')!.bucketId = 'design';
    definition.steps.splice(2, 0, { id: 'refine', name: 'Refinement', instructions: 'Refine the request.', kind: 'ai',
      output: 'markdown', access: 'none', provider: 'demo', model: 'sonnet', automatic: false, bucketId: 'next' });
    definition.steps.push({ id: 'review', name: 'Review changes', instructions: 'Inspect the captured work.', kind: 'approval', bucketId: 'progress' },
      { id: 'verify', name: 'Verify outcome', instructions: 'Check the result.', kind: 'checklist', bucketId: 'progress',
        items: [{ id: 'check', label: 'Inspect the result', required: true }] });
    await openWorkflowDisclosure(view, 'Workflow tools');
    await view.getByRole('button', { name: 'Import JSON', exact: true }).click();
    await view.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify(definition));
    await view.getByRole('button', { name: 'Preview import', exact: true }).click();
    await view.getByRole('button', { name: 'Replace draft', exact: true }).click();
    const outline = view.getByRole('region', { name: 'Workflow step order', exact: true });
    await browserExpect(outline.locator('[data-step-id]')).toHaveCount(8);
    for (const width of [1360, 760]) for (const theme of ['light', 'dark']) {
      await obsidian.page.setViewportSize({ width, height: 1000 });
      await obsidian.eval((_, selectedTheme) => {
        document.body.classList.toggle('theme-dark', selectedTheme === 'dark');
        document.body.classList.toggle('theme-light', selectedTheme === 'light');
      }, theme);
      await outline.scrollIntoViewIfNeeded();
      const rows = outline.locator('.cf-workflow-buckets');
      await rows.evaluate(el => { el.scrollTop = 0; });
      await obsidian.screenshot(`outline-${theme}-${width}-before`);
      const geometry = await outline.locator('.cf-workflow-step-select').evaluateAll(buttons => buttons.map(button => {
        const row = button.getBoundingClientRect();
        const number = button.querySelector('.cf-workflow-step-number')!.getBoundingClientRect();
        const name = button.querySelector('strong')!.getBoundingClientRect();
        return { name: button.querySelector('strong')!.textContent, numberInset: number.left - row.left, nameInset: name.left - row.left,
          height: row.height, overflows: button.scrollWidth > button.clientWidth + 1 };
      }));
      expect(geometry.every(row => row.numberInset >= 4 && row.numberInset <= 14)).toBe(true);
      expect(geometry.every(row => row.nameInset <= 46 && row.nameInset > row.numberInset)).toBe(true);
      expect(geometry.every(row => row.height <= 68 && !row.overflows), JSON.stringify({ width, theme, geometry })).toBe(true);
      expect(await outline.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      // Electron's CDP host cannot create Axe's auxiliary page; retain the same rules in-page.
      expect((await new AxeBuilder({ page: obsidian.page }).setLegacyMode(true).include('.cf-workflow-step-list')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
      const refinement = outline.locator('[data-step-id="refine"] .cf-workflow-step-select');
      await refinement.focus();
      await obsidian.page.keyboard.press('Enter');
      await browserExpect(view.getByLabel('Step name', { exact: true })).toHaveValue('Refinement');
      await view.getByRole('button', { name: 'Step list', exact: true }).click();
      await browserExpect(refinement).toBeFocused();
      const actionRows = await outline.locator('[data-step-id="refine"] .cf-workflow-step-actions button')
        .evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
      expect(Math.max(...actionRows) - Math.min(...actionRows)).toBeLessThanOrEqual(1);
      await openWorkflowDisclosure(view, 'Add a step');
      await browserExpect(outline.getByRole('button', { name: 'Add approval', exact: true })).toBeEnabled();
      await outline.locator('.cf-workflow-add-step > summary').click();
      await rows.evaluate(el => { el.scrollTop = 0; });
      await obsidian.page.mouse.move(width / 2, 10);
      await browserExpect(obsidian.page.locator('.tooltip')).toBeHidden();
      await browserExpect.poll(() => outline.evaluate(el => {
        const footer = el.closest('form')!.querySelector('.cf-workflow-editor-save')!.getBoundingClientRect();
        const tools = el.querySelector('.cf-workflow-step-list-tools')!.getBoundingClientRect();
        return tools.bottom <= footer.top;
      })).toBe(true);
      expect(await outline.locator('.cf-workflow-bucket-select strong').evaluateAll(labels =>
        labels.every(label => label.getBoundingClientRect().height <= 24))).toBe(true);
      await obsidian.screenshot(`outline-${theme}-${width}`);
      await outline.screenshot({ path: `${obsidian.directory}/panel-${theme}-${width}.png` });
    }
    expect(obsidian.errors()).toEqual([]);
  });
});
