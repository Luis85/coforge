import { openCouncilPage } from '../support/council-navigation';
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function capture(page: Page, state: string, theme: string) {
  await mkdir("reports/council-prompt-order", { recursive: true });
  const council = page.locator(".cf-council");
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await council.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".cf-council")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await council.screenshot({
      path: `reports/council-prompt-order/${state}-${theme}-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

for (const theme of ["light", "dark"]) {
  test(`round prompt order is editable and visible in the captured preflight in ${theme}`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((value) => {
      document.body.classList.toggle("theme-light", value === "light");
      document.body.classList.toggle("theme-dark", value === "dark");
    }, theme);
    await page
      .locator(".cf-sidebar")
      .getByRole("button", { name: "The Council", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Explore Council example", exact: true })
      .click();
    await openCouncilPage(page, 'Definitions');
    await page
      .locator(".cf-council-definition-list")
      .getByRole("button", { name: /^Example design council/ })
      .click();
    await expect(
      page.getByRole("combobox", {
        name: "Prompt order for Opinions",
        exact: true,
      }),
    ).toHaveValue("round-robin");
    await page
      .getByRole("combobox", { name: "Prompt order for Opinions", exact: true })
      .selectOption("fan-out");
    await page
      .getByRole("button", { name: "Save definition", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Definition saved for future runs." }),
    ).toBeVisible();
    await capture(page, "editor", theme);
    await openCouncilPage(page, 'Ask the Council');
    await page
      .getByLabel("Task title", { exact: true })
      .fill("Compare both routes");
    await page
      .getByLabel("Your question or task", { exact: true })
      .fill(
        "Give independent opinions, then propose a solution from the complete opinion collection.",
      );
    await page
      .getByRole("combobox", { name: "Council", exact: true })
      .selectOption("council-example");
    await page
      .getByRole("button", { name: "Save task and review", exact: true })
      .click();
    const preview = page.getByRole("region", {
      name: "Round prompt order",
      exact: true,
    });
    await expect(preview).toContainText(
      "Opinions · Fan out (concurrent) · 3 members",
    );
    await expect(preview).toContainText(
      "Solutions · Round robin (sequential) · 3 members",
    );
    await expect(page.locator(".cf-council-task-list")).toContainText(
      "Saved note · no retained run",
    );
    await capture(page, "preflight", theme);
  });
}
