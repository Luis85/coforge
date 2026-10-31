import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

for (const theme of ["light", "dark"])
  test(`studio activity stays readable and bounded across native button styles in ${theme}`, async ({
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
    await page
      .locator(".cf-sidebar")
      .getByRole("button", { name: /^Idea board/ })
      .click();
    await page
      .locator(".cf-board-page > .cf-page-heading")
      .getByRole("button", { name: "New request", exact: true })
      .click();
    const intake = page.getByRole("dialog", {
      name: "New request",
      exact: true,
    });
    await intake.getByLabel("The idea", { exact: true }).fill("W".repeat(120));
    await intake
      .getByLabel("A little more context", { exact: true })
      .fill("Keep long activity text inside its event row.");
    await intake
      .getByRole("button", { name: "Add to the board", exact: true })
      .click();
    await page.addStyleTag({
      content:
        ".ps--coforge .cf-studio button { white-space: nowrap; justify-content: center; align-items: center; }",
    });
    await page
      .getByRole("button", { name: "Recent activity", exact: true })
      .click();
    const popover = page.getByRole("complementary", {
      name: "Studio activity",
      exact: true,
    });
    await expect(popover).toBeVisible();
    await mkdir("reports/activity-popover", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await popover.evaluate((element) => {
        const scroll = element.querySelector(":scope > div");
        if (!scroll) throw new Error("Activity scroll viewport missing");
        const bounds = scroll.getBoundingClientRect();
        const content = [
          ...scroll.querySelectorAll(".cf-activity-item"),
        ].flatMap((row) => [
          ...row.querySelectorAll(
            "p, time, .cf-activity-body, .cf-activity-action",
          ),
        ]);
        return {
          excess: scroll.scrollWidth - scroll.clientWidth,
          vertical: bounds.height <= element.getBoundingClientRect().height,
          contained: content.every((child) => {
            const rect = child.getBoundingClientRect();
            return (
              rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            );
          }),
        };
      });
      expect(layout.excess).toBeLessThanOrEqual(1);
      expect(layout.contained).toBe(true);
      expect(layout.vertical).toBe(true);
      await expect(popover.locator(".cf-activity-item[disabled]")).toHaveCount(
        0,
      );
      await expect(popover.locator("time").first()).toHaveAttribute(
        "datetime",
        /\d{4}-\d\d-\d\dT/,
      );
      await popover.screenshot({
        path: `reports/activity-popover/${theme}-${width}.png`,
      });
    }
    await page
      .getByRole("button", { name: "Close activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Recent activity", exact: true }),
    ).toBeFocused();
  });
