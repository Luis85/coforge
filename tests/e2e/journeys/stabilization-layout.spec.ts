import { test, expect, type Locator } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { councilPageButton } from '../support/council-navigation';
import { openAgentWorkflow, openWorkflowSettings } from '../support/workflow-navigation';

async function assertSaveFooter(footer: Locator) {
  await expect(footer.getByRole('button')).toHaveText(['Discard changes', 'Save settings']);
  const measurements = await footer.evaluate(async element => {
    let scroll = element.parentElement;
    while (scroll && !/(?:auto|scroll)/u.test(getComputedStyle(scroll).overflowY)) scroll = scroll.parentElement;
    if (!scroll) throw new Error('Settings scroll viewport is unavailable');
    const original = scroll.scrollTop;
    const results = [];
    for (const position of ['middle', 'bottom']) {
      scroll.scrollTop = position === 'bottom' ? scroll.scrollHeight : (scroll.scrollHeight - scroll.clientHeight) / 2;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const viewport = scroll.getBoundingClientRect(); const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element); const background = style.backgroundColor;
      const alphaText = background.includes('/') ? background.split('/')[1]?.replace(')', '').trim() : background.startsWith('rgba(') ? background.split(',').at(-1)?.replace(')', '').trim() : '1';
      const alpha = Number.parseFloat(alphaText ?? '') / (alphaText?.endsWith('%') ? 100 : 1);
      const controls = [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      results.push({ position, gap: viewport.top + scroll.clientTop + scroll.clientHeight - bounds.bottom, background, alpha, opacity: style.opacity,
        footerBounded: bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1,
        controlsBounded: controls.every(control => control.left >= bounds.left - 1 && control.right <= bounds.right + 1 && control.top >= bounds.top - 1 && control.bottom <= bounds.bottom + 1) });
    }
    scroll.scrollTop = original;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return results;
  });
  for (const measurement of measurements) {
    expect(Math.abs(measurement.gap), `${measurement.position} footer bottom gap`).toBeLessThanOrEqual(1);
    expect(measurement.background).not.toBe('transparent'); expect(measurement.alpha).toBe(1); expect(measurement.opacity).toBe('1');
    expect(measurement.footerBounded).toBe(true);
    expect(measurement.controlsBounded).toBe(true);
  }
}

const views = [
  ["studio", "Stream studio", ".cf-broadcast-page"],
  ["statistics", "Statistics", ".cf-statistics-page"],
  ["finance", "Finances", ".cf-finance"],
  ["ai-costs", "AI costs", ".cf-ai-costs-page"],
  ["schedule", "Schedule", ".cf-stream-schedule-page"],
  ["board", "Idea board", ".cf-board-page"],
  ["chat", "Stream chat", ".cf-stream-page"],
  ["workflow", "Agent workflow", ".cf-settings-page"],
  ["council", "The Council", ".cf-council"],
  ["community", "Community", ".cf-community-page"],
  ["economy", "Economy", ".cf-economy-page"],
  ["viewers", "Viewers", ".cf-population-page"],
  ["operations", "Operations", ".cf-operations-page"],
  ["projects", "Projects", ".cf-projects-page"],
  ["community-settings", "Community settings", ".cf-community-settings-page"],
  ["settings", "Project settings", ".cf-settings-page"],
  ["workflow-settings", "Idea Board Workflow", ".cf-settings-page"],
] as const;

for (const theme of ["light", "dark"]) {
  for (const [id, label, selector] of views) {
    test(`${label}: shared operating frame and accessibility in ${theme}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1800, height: 1000 });
      await page.goto("/#surface=node-1");
      await expect(page.locator("html")).toHaveAttribute("data-prototype-ready", "true");
      await page.evaluate(theme => {
        document.body.classList.remove("theme-light", "theme-dark");
        document.body.classList.add(`theme-${theme}`);
      }, theme);
      if (id === "projects") await page.locator(".cf-project-switcher").click();
      else if (id === "workflow-settings") await openWorkflowSettings(page);
      else if (id === "workflow") await openAgentWorkflow(page);
      else await page.locator(".cf-sidebar").getByRole("button", {
        name: id === "board" ? /^Idea board/ : label, exact: id !== "board",
      }).first().click();
      if (id === "council") await page.getByRole("button", { name: "Explore Council example", exact: true }).click();
      if (id === "ai-costs") await page.getByRole("button", { name: "Explore example costs", exact: true }).click();
      if (id === "finance") await page.getByRole("button", { name: "Explore finance example", exact: true }).click();
      if (id === "schedule") await page.getByRole("button", { name: "Explore example schedule", exact: true }).click();
      const view = page.locator(selector);
      await expect(view).toBeVisible();
      if (id === 'workflow-settings') {
        await expect(view.locator('.cf-workflow-settings-page')).toBeVisible();
        await expect(view.getByRole('heading', { name: 'Idea Board Workflow', exact: true })).toBeVisible();
        await expect(view.getByRole('heading', { name: 'Agent workflow', level: 2, exact: true })).toBeVisible();
        await expect(view.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(view.locator('.cf-project-work-context')).toHaveCount(0);
        await expect(page.locator('.cf-project-switcher .cf-project-selector-id')).toContainText('CFP-001');
        await expect(view.locator('.cf-workflow-settings-page')).toHaveCSS('padding-top', '0px');
        await expect(view.locator('.cf-workflow-settings-page')).toHaveCSS('padding-left', '0px');
      }
      if (id === "ai-costs" || id === "schedule") {
        const input = page.getByLabel(id === "ai-costs" ? "Find a feature or task" : "Plan name", { exact: true });
        await expect(input).toHaveCSS("border-top-width", "1px");
      }
      await mkdir("reports/stabilization/operating-views", { recursive: true });
      // Resizing the leaf inside a wide desktop catches viewport-based responsive rules.
      for (const width of [1280, 480]) {
        await page.locator('[data-plugin-ui="coforge"]').first().evaluate((el, width) => {
          el.style.width = `${width}px`;
          el.style.maxWidth = `${width}px`;
        }, width);
        await expect.poll(() => view.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        if (id !== "board") {
          const footer = view.locator('.cf-settings-save');
          const hasSaveFooter = await footer.isVisible();
          if (id === 'settings') await expect(footer).toBeVisible();
          // Container queries may settle a frame after the leaf's inline width changes.
          await expect.poll(() => view.evaluate(el => {
            const style = getComputedStyle(el);
            return { padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], maxWidth: style.maxWidth };
          })).toEqual({
            padding: width <= 600 ? ["22px", "18px", hasSaveFooter ? "0px" : "36px", "18px"] : ["28px", "32px", hasSaveFooter ? "0px" : "48px", "32px"],
            maxWidth: "1440px",
          });
          if (hasSaveFooter) await assertSaveFooter(footer);
        }
        const violations = (await new AxeBuilder({ page }).include(selector)
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations;
        expect(violations.map(v => ({ rule: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.locator(".cf-studio").screenshot({ path: `reports/stabilization/operating-views/${id}-${theme}-${width}.png` });
      }
    });
  }
}

test("Council definition editor and cost filters reflow within a narrow desktop leaf", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute("data-prototype-ready", "true");
  await page.getByRole("button", { name: "The Council", exact: true }).first().click();
  await page.getByRole("button", { name: "Explore Council example", exact: true }).click();
  const subpage = await councilPageButton(page, 'Definitions');
  await subpage.click();
  await page.locator(".cf-council h1").click();
  expect(await subpage.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("none");
  await subpage.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(subpage).toBeFocused();
  expect(await subpage.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.locator('[data-plugin-ui="coforge"]').first().evaluate(el => { el.style.width = "480px"; el.style.maxWidth = "480px"; });
  expect(await page.locator(".cf-council-editor-layout").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(1);
  await page.getByRole("button", { name: "AI costs", exact: true }).click();
  await page.getByRole("button", { name: "Explore example costs", exact: true }).click();
  expect(await page.locator(".cf-ai-filters").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(1);
  const settings = page.locator(".cf-sidebar").getByRole("button", { name: "Project settings", exact: true });
  await settings.click();
  await page.locator(".cf-settings-page h1").click();
  expect(await settings.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("none");
  await settings.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(settings).toBeFocused();
  expect(await settings.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
});
