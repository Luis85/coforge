import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
test("reviews all four read-only public projections and excludes simulated chat", async ({
  page,
}) => {
  await page.goto("/#surface=node-1");
  await expect(page.locator("html")).toHaveAttribute(
    "data-prototype-ready",
    "true",
  );
  await page.getByText("Public stream displays", { exact: true }).click();
  await mkdir("reports/product-audit", { recursive: true });
  for (const [label, id] of [
    ["Stream Kanban", "kanban"],
    ["Stream Chat", "chat"],
    ["Stream Leaderboards", "leaderboards"],
    ["Stream Community", "community"],
  ]) {
    await page
      .getByRole("button", { name: `Preview ${label}`, exact: true })
      .click();
    const surface = page.locator(`.cf-stream-surface-${id}`);
    await expect(surface).toBeVisible();
    await expect(surface.locator("input,button,textarea")).toHaveCount(0);
    await expect(surface).not.toContainText("simulator:");
    await expect(surface).not.toContainText("projectPath");
    if (id === "chat") {
      await expect(surface).not.toContainText("!vote CF-101");
      await expect(
        surface.getByRole("region", {
          name: "Public Twitch chat",
          exact: true,
        }),
      ).toBeVisible();
    }
    const axe = await new AxeBuilder({ page })
      .include(`.cf-stream-surface-${id}`)
      .analyze();
    expect(axe.violations).toEqual([]);
    await surface.screenshot({
      path: `reports/product-audit/public-${id}.png`,
    });
    await page
      .getByRole("button", {
        name: "Close public display preview",
        exact: true,
      })
      .click();
  }
});
