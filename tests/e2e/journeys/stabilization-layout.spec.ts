import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const views = [
  ["studio", "Stream studio", ".cf-broadcast-page"],
  ["statistics", "Statistics", ".cf-statistics-page"],
  ["finance", "Finances", ".cf-finance"],
  ["ai-costs", "AI costs", ".cf-ai-costs-page"],
  ["schedule", "Schedule", ".cf-stream-schedule-page"],
  ["board", "Idea board", ".cf-board-page"],
  ["chat", "Stream chat", ".cf-stream-page"],
  ["workflow", "Agent workflow", ".cf-workflow-page"],
  ["council", "The Council", ".cf-council"],
  ["community", "Community", ".cf-community-page"],
  ["viewers", "Viewers", ".cf-population-page"],
  ["operations", "Operations", ".cf-operations-page"],
  ["projects", "Projects", ".cf-projects-page"],
  ["community-settings", "Community settings", ".cf-community-settings-page"],
  ["settings", "Project settings", ".cf-settings-page"],
  ["workflow-settings", "Workflow settings", ".cf-workflow-settings-page"],
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
      else await page.locator(".cf-sidebar").getByRole("button", {
        name: id === "board" ? /^Idea board/ : label, exact: id !== "board",
      }).first().click();
      if (id === "council") await page.getByRole("button", { name: "Explore Council example", exact: true }).click();
      if (id === "ai-costs") await page.getByRole("button", { name: "Explore example costs", exact: true }).click();
      if (id === "finance") await page.getByRole("button", { name: "Explore finance example", exact: true }).click();
      if (id === "schedule") await page.getByRole("button", { name: "Explore example schedule", exact: true }).click();
      const view = page.locator(selector);
      await expect(view).toBeVisible();
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
          // Container queries may settle a frame after the leaf's inline width changes.
          await expect.poll(() => view.evaluate(el => {
            const style = getComputedStyle(el);
            return { padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], maxWidth: style.maxWidth };
          })).toEqual({
            padding: width <= 600 ? ["22px", "18px", "36px", "18px"] : ["28px", "32px", "48px", "32px"],
            maxWidth: "1440px",
          });
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
  const subpage = page.getByRole("navigation", { name: "Council workspace", exact: true }).getByRole("button", { name: "Definitions", exact: true });
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
