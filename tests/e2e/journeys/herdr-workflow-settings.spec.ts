import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const theme of ["light", "dark"]) {
  test(`Herdr per-step settings keep verified scope and explain unavailable native capability in ${theme}`, async ({
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
    await page
      .getByRole("button", { name: "Studio settings", exact: true })
      .click();
    await page
      .getByLabel("Workflow step", { exact: true })
      .selectOption("screen");
    await page
      .getByLabel("Step provider", { exact: true })
      .selectOption("herdr");
    const agent = page.getByLabel("Step Herdr agent type", { exact: true });
    expect(await agent.locator("option").allTextContents()).toEqual([
      "Use project default (Claude Code)",
      "Claude Code",
    ]);
    await agent.selectOption("claude");
    await page.getByLabel("Step model", { exact: true }).fill("haiku");
    await expect(
      page.getByText("Herdr workflow unavailable", { exact: true }),
    ).toBeVisible();
    const section = page.getByRole("region", {
      name: "Workflow step configuration",
      exact: true,
    });
    await expect(section).toContainText("Herdr · Claude Code · haiku");
    await expect(section).toContainText(
      "native CLI budget cap does not enforce Herdr spending",
    );
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await expect(
      page.getByText("Settings saved", { exact: true }),
    ).toBeVisible();
    await mkdir("reports/herdr-workflow", { recursive: true });
    for (const width of [1280, 360]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await section.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await section.screenshot({
        path: `reports/herdr-workflow/settings-${theme}-${width}.png`,
      });
    }
    expect(
      (await new AxeBuilder({ page }).include(".cf-settings-page").analyze())
        .violations,
    ).toEqual([]);
    await page
      .getByRole("button", { name: "Agent workflow", exact: true })
      .click();
    const stage = page.locator(".cf-workflow-stage").first();
    await expect(stage).toContainText("Herdr · Claude Code · haiku");
    await expect(stage).toContainText(
      /Herdr workflow is unavailable|workspace/,
    );
    const automatic = stage.getByRole("checkbox");
    if (await automatic.isChecked()) await automatic.click();
    await expect(automatic).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Configure step: Screen the request",
        exact: true,
      })
      .click();
    await expect(agent).toHaveValue("claude");
    await page
      .getByRole("button", {
        name: "Use project defaults for this step",
        exact: true,
      })
      .click();
    await expect(agent).toHaveCount(0);
    await expect(page.getByLabel("Step provider", { exact: true })).toHaveValue(
      "",
    );
  });
}
