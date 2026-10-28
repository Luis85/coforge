import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const theme of ["light", "dark"])
  test(`aggregates provider token usage without turning unknown into zero in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-dark", theme === "dark");
      document.body.classList.toggle("theme-light", theme === "light");
    }, theme);
    await page.getByRole("button", { name: "AI costs", exact: true }).click();
    await page
      .getByRole("button", { name: "Explore example costs", exact: true })
      .click();
    const usage = page.getByRole("region", {
      name: "Token usage",
      exact: true,
    });
    const counter = (label: string) =>
      usage
        .locator("dt")
        .filter({ hasText: label })
        .locator("..")
        .locator("dd strong");
    await expect(counter("Uncached input tokens")).toHaveText("200");
    await expect(counter("Output tokens")).toHaveText("80");
    await expect(counter("Cache-read input tokens")).toHaveText("40");
    await expect(counter("Cache-write input tokens")).toHaveText("10");
    await expect(usage).toContainText("2 / 3 tasks reported");
    await expect(usage).toContainText("250");
    const build = page.getByRole("row").filter({ hasText: "example-build-1" });
    await expect(build.getByRole("cell").nth(4)).toContainText("80");
    await expect(build.getByRole("cell").nth(5)).toContainText("50");
    const herdr = page.getByRole("row").filter({ hasText: "example-herdr-1" });
    await expect(herdr.getByRole("cell").nth(4)).toContainText("Unavailable");
    await expect(herdr.getByRole("cell").nth(5)).toContainText("Unavailable");
    await page
      .getByLabel("Find a feature or task", { exact: true })
      .fill("CF-002");
    await expect(counter("Uncached input tokens")).toHaveText("Unavailable");
    await expect(counter("Output tokens")).toHaveText("Unavailable");
    await page
      .getByLabel("Find a feature or task", { exact: true })
      .fill("CF-001");
    await expect(counter("Uncached input tokens")).toHaveText("200");
    await mkdir("reports/ai-usage", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page
          .locator(".cf-content")
          .evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
      ).toBe(true);
      await page.screenshot({
        path: `reports/ai-usage/${theme}-${width}.png`,
        fullPage: true,
      });
      expect(
        (
          await new AxeBuilder({ page })
            .include(".cf-ai-costs")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  });
