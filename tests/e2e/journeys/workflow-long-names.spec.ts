import { test, expect, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { openWorkflowDisclosure, openWorkflowRuns, openWorkflowSettings } from '../support/workflow-navigation';

const dimensions = (surface: Locator) => surface.evaluate(element => ({
  clientWidth: element.clientWidth,
  scrollWidth: element.scrollWidth,
}));

test('valid 100-character workflow and template names reflow with selected and captured sources open at 320px', async ({ page }) => {
  const workflowName = 'W'.repeat(100);
  const templateName = 'T'.repeat(100);
  const markdown = '# Decision\n\n## Evidence\n\nKeep the full answer outline.';
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  await openWorkflowSettings(page);
  await page.getByRole('button', { name: 'Manage templates', exact: true }).click();
  const library = page.locator('.cf-workflow-template-library');
  await library.getByRole('button', { name: 'New template', exact: true }).click();
  await library.getByLabel('Template name', { exact: true }).fill(templateName);
  await library.getByLabel('Template Markdown', { exact: true }).fill(markdown);
  await library.getByRole('button', { name: 'Save template', exact: true }).click();
  await expect(library.locator('.cf-workflow-editor-notice')).toContainText('Template saved.');
  const templateId = await library.getByLabel('Template library', { exact: true }).inputValue();
  await openWorkflowDisclosure(page, 'Workflow tools');
  await page.getByRole('button', { name: 'Import JSON', exact: true }).click();
  await page.getByLabel('Or paste workflow JSON', { exact: true }).fill(JSON.stringify({
    format: 'coforge-workflow/v1', revision: 'long-names', name: workflowName,
    limits: { timeoutSeconds: 180, maxTurns: 12, maxBudgetUsd: 1, intervalSeconds: 5 },
    steps: [
      { id: 'hold', kind: 'approval', name: 'Hold for review', instructions: 'Inspect the captured answer outline.' },
      { id: 'report', kind: 'ai', name: 'Prepare report', instructions: 'Prepare a report using the selected outline.', output: 'markdown', access: 'none', provider: 'demo', model: 'sonnet', automatic: false, outputTemplateId: templateId },
    ],
  }));
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.getByRole('button', { name: 'Replace draft', exact: true }).click();
  await page.locator('[data-step-id="report"] .cf-workflow-step-select').click();
  await page.getByText('Preview selected template', { exact: true }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  const selected = page.locator('.cf-workflow-selected-template');
  await expect(selected.getByLabel('Selected template Markdown source', { exact: true })).toHaveText(markdown);
  const selectedSize = await dimensions(selected);
  expect(selectedSize.scrollWidth).toBeLessThanOrEqual(selectedSize.clientWidth + 1);
  await mkdir('reports/workflow-output-templates', { recursive: true });
  await selected.screenshot({ path: 'reports/workflow-output-templates/long-selected-source-320.png' });
  await page.getByRole('button', { name: 'Save workflow', exact: true }).click();
  await expect(page.getByText('Workflow saved. New runs use this definition; existing runs retain their captured steps.', { exact: true })).toBeVisible();
  await openWorkflowRuns(page);
  const run = page.getByRole('region', { name: 'Request workflow execution', exact: true });
  await run.getByRole('button', { name: 'Start · Hold for review', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Manual workflow step', exact: true })).toBeVisible();
  const captured = page.getByRole('group', { name: 'Captured workflow configuration', exact: true });
  await captured.locator(':scope > summary').click();
  await expect(captured).toContainText(workflowName);
  await captured.locator('.cf-workflow-template-preview > summary').click();
  await captured.getByText('Markdown source', { exact: true }).click();
  await expect(captured.getByLabel(`Captured Markdown source for ${templateName}`, { exact: true })).toHaveText(markdown);
  const capturedSize = await dimensions(captured);
  const pageSize = await dimensions(page.locator('.cf-workflow-page'));
  expect(capturedSize.scrollWidth).toBeLessThanOrEqual(capturedSize.clientWidth + 1);
  expect(pageSize.scrollWidth).toBeLessThanOrEqual(pageSize.clientWidth + 1);
  await captured.screenshot({ path: 'reports/workflow-output-templates/long-captured-source-320.png' });
  await writeFile('reports/workflow-output-templates/long-name-reflow.json', JSON.stringify({ viewport: 320, workflowNameLength: workflowName.length, templateNameLength: templateName.length, selected: selectedSize, captured: capturedSize, page: pageSize }, null, 2));
});
