import { expect as browserExpect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect } from 'vitest';
import { parse } from 'yaml';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, type ObsidianHarness } from './support/obsidian-fixture';
import { splitNote } from '../../../src/plugin/infrastructure/coforge/markdown';

async function serviceNotes(obsidian: ObsidianHarness) {
  return obsidian.eval(async ({ app }) => {
    const files = app.vault.getMarkdownFiles().filter(file => file.path.startsWith('CoForge/Service Design/') || file.path.startsWith('Private/Service Design/'));
    return Promise.all(files.map(async file => ({ path: file.path, content: await app.vault.read(file) })));
  });
}
async function screenshot(obsidian: ObsidianHarness, name: string) {
  // Native host tooltips can outlive pointer movement across Electron chrome.
  // Hide that unrelated transient overlay only for the screenshot exposure.
  await obsidian.page.screenshot({ path: join(obsidian.directory, `${name}.png`), style: '.tooltip { visibility: hidden !important; }' });
}
interface BlueprintGeometry {
  pageOverflow: number; editorOverflow: number; mapOverflow: number;
  pageWidth: number; leftGutter: number; rightGutter: number; editorHeaderGap: number;
}

describe('Service Design in the contained host', () => {
  test('authors linked service entities, keeps old folders discoverable and protects external edits across reload', async ({ obsidian }) => {
    const type = `${obsidian.pluginId}-view-project-workbench`;
    let view = await obsidian.openView(type);
    await view.locator('.cf-project-switcher').click();
    await view.getByRole('button', { name: 'Add project', exact: true }).click();
    await view.getByLabel('Project name', { exact: true }).fill('Service Design acceptance');
    await view.getByLabel(/^Project path/).fill('/synthetic/service-design');
    await view.getByLabel('Description', { exact: true }).fill('Contained service blueprint acceptance.');
    await view.getByRole('button', { name: 'Create project', exact: true }).click();
    await browserExpect(view.locator('.cf-project-switcher')).toContainText('Service Design acceptance');
    await view.getByRole('button', { name: 'Service Design', exact: true }).click();
    await browserExpect(view.getByRole('heading', { name: 'Service Design', exact: true })).toBeVisible();
    await view.getByRole('button', { name: 'Create service blueprint', exact: true }).click();
    await view.getByLabel('Entity title', { exact: true }).fill('Newcomer onboarding');
    await view.getByLabel('Markdown notes', { exact: true }).fill('# Customer goal\nJoin the community with confidence.\n');
    await view.getByRole('button', { name: 'Save entity', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Service blueprint overview', exact: true })).toContainText('Newcomer onboarding');
    await view.getByRole('button', { name: 'Add journey step', exact: true }).click();
    await view.getByLabel('Entity title', { exact: true }).fill('Join community');
    await view.getByLabel('Order', { exact: true }).fill('1');
    await view.getByRole('button', { name: 'Save entity', exact: true }).click();
    const stepHeader = view.getByRole('button', { name: 'Edit journey step: Step 1 Join community', exact: true });
    await browserExpect(stepHeader).toBeVisible();
    for (const [index, title] of ['Explore options', 'Get help'].entries()) {
      await view.getByLabel('New entity type', { exact: true }).selectOption('journey-step');
      await view.getByRole('button', { name: 'Add entity', exact: true }).click();
      await view.getByLabel('Entity title', { exact: true }).fill(title);
      await view.getByRole('button', { name: 'Save entity', exact: true }).click();
      await browserExpect(view.getByRole('button', { name: `Edit journey step: Step ${index + 2} ${title}`, exact: true })).toBeVisible();
    }
    await view.getByRole('button', { name: 'Add Customer action to Join community', exact: true }).click();
    await browserExpect(view.getByLabel('Entity title', { exact: true })).toBeFocused();
    await view.getByLabel('Entity title', { exact: true }).fill('Register account');
    const actionBody = 'Complete the **registration** form.\n\nKeep the customer’s intent.';
    await view.getByLabel('Markdown notes', { exact: true }).fill(actionBody);
    await browserExpect(view.getByLabel('Journey step', { exact: true })).toHaveValue(/sd-/);
    await view.getByRole('checkbox', { name: 'Join community Journey step', exact: true }).check();
    await view.getByRole('button', { name: 'Save entity', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Scrollable service blueprint', exact: true })).toContainText('Register account');
    const created = await serviceNotes(obsidian);
    expect(created).toHaveLength(5);
    const action = created.find(note => note.content.includes('kind: customer-action'))!;
    const step = created.find(note => note.content.includes('title: Join community'))!;
    const blueprint = created.find(note => note.content.includes('kind: blueprint'))!;
    const actionParts = splitNote(action.content);
    const actionProperties: unknown = parse(actionParts.yaml!);
    expect(actionParts.body).toBe(actionBody);
    expect(actionProperties).toMatchObject({ type: 'coforge-service-design', schema: 1,
      blueprint: `[[${blueprint.path.slice(0, -3)}]]`, step: `[[${step.path.slice(0, -3)}]]`, related: [`[[${step.path.slice(0, -3)}]]`] });
    await view.getByText('Note storage', { exact: true }).click();
    await view.getByLabel('Service Design folder', { exact: true }).fill('Private/Service Design');
    await view.getByRole('button', { name: 'Save folder', exact: true }).click();
    await browserExpect(view.getByText('Service Design folder saved. Existing notes stay in their folders.', { exact: true })).toBeVisible();
    await view.getByLabel('New entity type', { exact: true }).selectOption('actor');
    await view.getByRole('button', { name: 'Add entity', exact: true }).click();
    await view.getByLabel('Entity title', { exact: true }).fill('Community guide');
    await view.getByRole('button', { name: 'Save entity', exact: true }).click();
    await expect.poll(async () => (await serviceNotes(obsidian)).filter(note => note.path.startsWith('Private/Service Design/')).length).toBe(1);
    expect(await obsidian.eval(({ app }) => app.vault.adapter.read('Private/Service Design/.gitignore'))).toContain('*');
    await obsidian.reloadPlugin();
    view = await obsidian.openView(type);
    await view.getByRole('button', { name: 'Service Design', exact: true }).click();
    await browserExpect(view.getByRole('region', { name: 'Service blueprint overview', exact: true })).toContainText('Newcomer onboarding');
    await browserExpect(view.getByRole('region', { name: 'Service Design entities', exact: true })).toContainText('Community guide');
    await browserExpect(view.getByRole('region', { name: 'Scrollable service blueprint', exact: true })).toContainText('Register account');
    await view.getByRole('button', { name: 'Edit blueprint', exact: true }).click();
    const geometryIssues: Array<BlueprintGeometry & { size: string; theme: string }> = [];
    const accessibilityIssues: Array<{ size: string; theme: string; rule: string; impact: string | null | undefined; nodes: unknown[] }> = [];
    for (const size of ['wide', 'narrow'] as const) {
      await obsidian.page.setViewportSize({ width: size === 'wide' ? 1800 : 1050, height: 1100 });
      for (const theme of ['light', 'dark'] as const) {
        await obsidian.eval((_context, theme) => {
          document.body.classList.remove('theme-light', 'theme-dark');
          document.body.classList.add(`theme-${theme}`);
        }, theme);
        await browserExpect(obsidian.page.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
        await view.locator('.cf-content').evaluate(element => { element.scrollTop = 0; });
        await view.getByRole('heading', { name: 'Service Design', exact: true }).hover();
        const geometry = await view.locator('.cf-service-design').evaluate(element => {
          const map = element.querySelector('.cf-blueprint-scroll');
          const editor = element.querySelector('.cf-blueprint-editor');
          const heading = element.querySelector('.cf-page-heading');
          const editorHeader = editor?.querySelector('header');
          const fields = editor?.querySelector('.cf-blueprint-fields');
          if (!(map instanceof HTMLElement) || !(editor instanceof HTMLElement) || !heading || !editorHeader || !fields) throw new Error('Blueprint geometry is unavailable');
          const pageBounds = element.getBoundingClientRect();
          const headingBounds = heading.getBoundingClientRect();
          return { pageOverflow: element.scrollWidth - element.clientWidth, editorOverflow: editor.scrollWidth - editor.clientWidth,
            mapOverflow: map.scrollWidth - map.clientWidth, pageWidth: pageBounds.width,
            leftGutter: headingBounds.left - pageBounds.left, rightGutter: pageBounds.right - headingBounds.right,
            editorHeaderGap: fields.getBoundingClientRect().top - editorHeader.getBoundingClientRect().bottom };
        });
        await writeFile(join(obsidian.directory, `service-design-${size}-${theme}-geometry.json`), JSON.stringify(geometry, null, 2));
        if (geometry.pageOverflow > 1 || geometry.editorOverflow > 1 || (size === 'narrow' && geometry.mapOverflow <= 0)
          || geometry.pageWidth > 1441 || geometry.leftGutter <= 0 || geometry.rightGutter <= 0 || geometry.editorHeaderGap <= 0)
          geometryIssues.push({ size, theme, ...geometry });
        // Electron CDP cannot create axe's temporary blank target. The native
        // Service Design subtree has no frames, so axe's documented same-page
        // mode retains the complete accessibility scope of this surface.
        const accessibility = await new AxeBuilder({ page: obsidian.page }).setLegacyMode().include('.cf-service-design').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        await writeFile(join(obsidian.directory, `service-design-${size}-${theme}-accessibility.json`), JSON.stringify(accessibility.violations, null, 2));
        accessibilityIssues.push(...accessibility.violations.map(violation => ({ size, theme, rule: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => ({ target: node.target, failure: node.failureSummary })) })));
        await screenshot(obsidian, `service-design-${size}-${theme}`);
      }
    }
    await obsidian.page.setViewportSize({ width: 1800, height: 1100 });
    await view.getByRole('region', { name: 'Scrollable service blueprint', exact: true }).getByRole('button', { name: /Register account/ }).click();
    await view.getByLabel('Entity title', { exact: true }).fill('Retained conflicting edit');
    const external = action.content + '\nExternal annotation kept.\n';
    await obsidian.eval(async ({ app }, note) => {
      const file = app.vault.getFileByPath(note.path);
      if (!file) throw new Error('Missing contained service action');
      await app.vault.modify(file, note.content);
    }, { path: action.path, content: external });
    await view.getByRole('button', { name: 'Save entity', exact: true }).click();
    await browserExpect(view.getByRole('alert')).toContainText('Refresh');
    await browserExpect(view.getByLabel('Entity title', { exact: true })).toHaveValue('Retained conflicting edit');
    expect(await obsidian.eval(({ app }, path) => app.vault.adapter.read(path), action.path)).toBe(external);
    await view.getByRole('button', { name: 'Refresh blueprint', exact: true }).click();
    await browserExpect(view.getByLabel('Entity title', { exact: true })).toHaveValue('Retained conflicting edit');
    await view.getByRole('region', { name: 'Scrollable service blueprint', exact: true }).getByRole('button', { name: /Register account/ }).click();
    await view.getByRole('button', { name: 'Discard draft and continue', exact: true }).click();
    await browserExpect(view.getByLabel('Markdown notes', { exact: true })).toHaveValue(actionBody + '\nExternal annotation kept.\n');
    await view.locator('.cf-blueprint-editor').scrollIntoViewIfNeeded();
    const editorAccessibility = await new AxeBuilder({ page: obsidian.page }).setLegacyMode().include('.cf-blueprint-editor').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await writeFile(join(obsidian.directory, 'service-design-editor-dark-accessibility.json'), JSON.stringify(editorAccessibility.violations, null, 2));
    expect(editorAccessibility.violations.map(violation => ({ rule: violation.id, targets: violation.nodes.map(node => node.target) }))).toEqual([]);
    await view.locator('.cf-blueprint-editor h2').hover();
    await screenshot(obsidian, 'service-design-canonical-blueprint-and-external-edit-recovery');
    expect(geometryIssues).toEqual([]);
    expect(accessibilityIssues).toEqual([]);
    expect(obsidian.errors()).toEqual([]);
  });
});
