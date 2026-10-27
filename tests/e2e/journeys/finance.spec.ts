import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const theme of ["light", "dark"])
  test(`manual finance ledger in ${theme}`, async ({ page }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-dark", theme === "dark");
      document.body.classList.toggle("theme-light", theme === "light");
    }, theme);
    await page.getByRole("button", { name: "Finances", exact: true }).click();
    await page
      .getByRole("button", { name: "Explore finance example", exact: true })
      .click();
    const form = page.getByRole("region", {
      name: "Finance entry editor",
      exact: true,
    });
    for (const [kind, name, amount] of [
      ["income", "October tips", "50.05"],
      ["expense", "Artwork payment", "20"],
      ["recurring", "Editor subscription", "120"],
    ]) {
      await form.getByLabel("Entry type", { exact: true }).selectOption(kind);
      await form.getByLabel("Finance description", { exact: true }).fill(name);
      await form.getByLabel("Amount (EUR)", { exact: true }).fill(amount);
      if (kind === "recurring")
        await form
          .getByLabel("Expense interval", { exact: true })
          .selectOption("yearly");
      await form
        .getByRole("button", { name: "Save finance entry", exact: true })
        .click();
      await expect(
        page.getByRole("list", { name: "Finance entries", exact: true }),
      ).toContainText(name);
    }
    await expect(
      page.getByLabel("Actual balance", { exact: true }),
    ).toContainText("30.05");
    await expect(
      page.getByLabel("Planned monthly costs", { exact: true }),
    ).toContainText("10.00");
    await page.getByRole("button", { name: "Pause plan", exact: true }).click();
    await expect(
      page.getByLabel("Planned monthly costs", { exact: true }),
    ).toContainText("0.00");
    await page
      .getByRole("button", { name: "Edit Artwork payment", exact: true })
      .click();
    await form.getByLabel("Amount (EUR)", { exact: true }).fill("25");
    await form
      .getByRole("button", { name: "Save finance entry", exact: true })
      .click();
    await expect(
      page.getByLabel("Actual balance", { exact: true }),
    ).toContainText("25.05");
    await page
      .getByRole("button", { name: "Delete Artwork payment", exact: true })
      .click();
    const confirmation = page.getByRole("region", {
      name: "Confirm finance deletion",
      exact: true,
    });
    await expect(confirmation).toBeFocused();
    await confirmation
      .getByRole("button", { name: "Confirm finance deletion", exact: true })
      .click();
    await expect(
      page.getByRole("list", { name: "Finance entries", exact: true }),
    ).not.toContainText("Artwork payment");
    await mkdir("reports/finance", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      const size = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(size.content).toBeLessThanOrEqual(size.width);
      await test
        .info()
        .attach(`finance-${theme}-${width}`, {
          body: await page
            .locator(".cf-finance")
            .screenshot({ path: `reports/finance/${theme}-${width}.png` }),
          contentType: "image/png",
        });
    }
  });
