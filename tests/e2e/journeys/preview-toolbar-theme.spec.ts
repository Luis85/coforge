import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('preview toolbar controls retain the host theme when a mounted surface retains a different foreground', async ({ page }) => {
  await page.goto('/#surface=node-1');
  await expect(page.locator('html')).toHaveAttribute('data-prototype-ready', 'true');
  for (const surface of ['node-1', 'node-2']) {
    await page.locator('#clickdummy-surface').selectOption(surface);
    for (const theme of ['light', 'dark', 'light']) {
      const palette = await page.evaluate(theme => {
        const mounted = document.querySelector<HTMLElement>('.clickdummy-preview');
        if (!mounted) throw new Error('Preview toolbar fixture is unavailable');
        // A product surface can retain its own foreground; it must not recolor the host toolbar.
        mounted.style.color = getComputedStyle(document.body).color;
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
        const host = getComputedStyle(document.body);
        const field = document.createElement('span'); field.style.backgroundColor = 'var(--background-modifier-form-field)'; document.body.append(field);
        const fieldBackground = getComputedStyle(field).backgroundColor; field.remove();
        return { foreground: host.color, background: host.backgroundColor, fieldBackground };
      }, theme);
      await expect(page.locator('.clickdummy-toolbar')).toHaveCSS('color', palette.foreground);
      await expect(page.locator('.clickdummy-toolbar')).toHaveCSS('background-color', palette.background);
      for (const id of ['clickdummy-surface', 'clickdummy-state', 'clickdummy-scenario']) {
        await expect(page.locator('#' + id)).toHaveCSS('color', palette.foreground);
        await expect(page.locator('#' + id)).toHaveCSS('background-color', palette.fieldBackground);
      }
      const issues = await new AxeBuilder({ page }).include('.clickdummy-toolbar').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(issues.violations).toEqual([]);
    }
  }
});
