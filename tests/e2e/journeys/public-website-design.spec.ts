import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { renderPublicSite } from "../../../src/plugin/features/coforge/domain/public-site";
import { PUBLIC_SITE_CSS } from "../../../src/plugin/features/coforge/domain/public-site-styles";
import { buildPublicBoard } from "../../../src/plugin/features/coforge/domain/public-board";
import { createSeed } from "../../../src/plugin/features/coforge/domain/seed";

for (const theme of ["light", "dark"] as const) {
  test(`exported viewer website is readable, navigable and script-free in ${theme}`, async ({
    page,
  }) => {
    const when = new Date("2026-10-28T18:00:00Z");
    const board = buildPublicBoard(createSeed(when.getTime()), when);
    await page.route("**/public-review/", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: renderPublicSite(board),
      }),
    );
    await page.route("**/public-review/styles.css", (route) =>
      route.fulfill({
        contentType: "text/css",
        body: PUBLIC_SITE_CSS,
      }),
    );
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/public-review/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      board.project,
    );
    await expect(page.locator("script,input,button,textarea")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("simulator:");
    await expect(page.locator("body")).not.toContainText("projectPath");
    await mkdir("reports/product-audit", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `reports/product-audit/public-website-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    const nav = page.getByRole("navigation", { name: "Viewer board sections" });
    await expect(nav.getByRole("link")).toHaveCount(3);
    await nav.getByRole("link", { name: "Leaderboards", exact: true }).click();
    await expect(page).toHaveURL(/#leaderboards$/);
    const disclosure = page.locator(".plan summary").first();
    await disclosure.focus();
    await disclosure.press("Enter");
    await expect(page.locator(".plan").first()).toHaveAttribute("open", "");
  });
}
