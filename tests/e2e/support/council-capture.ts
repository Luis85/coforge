import { showAdvancedCouncilTools } from './council-navigation';
import { expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

export async function captureCouncil(page: Page, name: string, theme: string, selector = '.cf-council') {
  await mkdir("reports/council", { recursive: true });
  const council = page.locator(selector);
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await council.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await council.screenshot({
      path: `reports/council/${name}-${theme}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(
    (
      await new AxeBuilder({ page })
        .include(selector)
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}
export async function openCouncilReview(
  page: Page,
  scenario: string,
  theme: string,
) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `/?council-review=${encodeURIComponent(scenario)}#surface=node-1`,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.evaluate((value) => {
    document.body.classList.toggle("theme-light", value === "light");
    document.body.classList.toggle("theme-dark", value === "dark");
  }, theme);
  await page
    .getByRole("button", { name: "The Council", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Explore Council example", exact: true })
    .click();
  await showAdvancedCouncilTools(page);
  return errors;
}
