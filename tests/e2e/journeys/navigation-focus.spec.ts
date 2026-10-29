import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`navigation selection stays contained with distinct keyboard focus in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-light", theme === "light");
      document.body.classList.toggle("theme-dark", theme === "dark");
    }, theme);
    for (const width of [1280, 800]) {
      await page.setViewportSize({ width, height: 900 });
      const nav = page.getByRole("navigation", {
        name: "CoForge navigation",
        exact: true,
      });
      const button = nav.getByRole("button", {
        name: "Stream studio",
        exact: true,
      });
      await expect(nav.getByRole("button", { name: "Workflow settings", exact: true })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Agent workflow", exact: true })).toHaveCount(0);
      await expect(nav.getByRole("button", { name: "Project settings", exact: true }).locator('.cf-icon svg')).toBeVisible();
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "page");
      await page.locator(".cf-broadcast-page h1").click();
      expect(
        await button.evaluate((el) => getComputedStyle(el).outlineStyle),
      ).toBe("none");
      await nav.getByRole("button", { name: "Schedule", exact: true }).focus();
      await page.keyboard.press("Shift+Tab");
      await expect(button).toBeFocused();
      expect(
        await button.evaluate((el) => ({
          style: getComputedStyle(el).outlineStyle,
          offset: getComputedStyle(el).outlineOffset,
        })),
      ).toEqual({ style: "solid", offset: "-3px" });
      await button.screenshot({
        path: `reports/product-audit/navigation-${theme}-${width}.png`,
      });
    }
  });
}
