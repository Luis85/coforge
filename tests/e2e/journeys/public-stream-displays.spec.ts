import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const [label, id, content] of [
  ["Stream Kanban", "kanban", "screened requests"],
  ["Stream Chat", "chat", "The conversation starts here"],
  ["Stream Leaderboards", "leaderboards", "Most supported"],
  ["Stream Community", "community", "Rank ladder"],
]) {
  test(`public ${id} has styled useful read-only content and excludes private data`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.getByText("Public stream displays", { exact: true }).click();
    await page
      .getByRole("button", { name: `Preview ${label}`, exact: true })
      .click();
    const surface = page.locator(`.cf-stream-surface-${id}`);
    await expect(surface).toBeVisible();
    await expect(surface.locator("input,button,textarea,a")).toHaveCount(0);
    await expect(surface).not.toContainText("simulator:");
    await expect(surface).not.toContainText("projectPath");
    await expect(surface).toContainText(content);
    await expect(surface).toContainText("!register");
    await mkdir("reports/product-audit", { recursive: true });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.body.classList.toggle("theme-light", theme === "light");
        document.body.classList.toggle("theme-dark", theme === "dark");
      }, theme);
      const axe = await new AxeBuilder({ page })
        .include(`.cf-stream-surface-${id}`)
        .analyze();
      expect(axe.violations).toEqual([]);
      for (const width of [1280, 360]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
        await surface.screenshot({
          path: `reports/product-audit/public-${id}-${theme}-${width}.png`,
        });
      }
    }
  });
}
