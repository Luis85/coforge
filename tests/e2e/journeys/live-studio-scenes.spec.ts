import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
for (const theme of ["light", "dark"])
  test(`live studio and scene maintenance in ${theme}`, async ({ page }) => {
    await page.goto("/#surface=node-1");
    await expect(page.locator("html")).toHaveAttribute(
      "data-prototype-ready",
      "true",
    );
    await page.evaluate((theme) => {
      document.body.classList.toggle("theme-dark", theme === "dark");
      document.body.classList.toggle("theme-light", theme === "light");
    }, theme);
    const monitor = page.getByRole("region", {
      name: "Live stream monitor",
      exact: true,
    });
    await expect(
      monitor.getByLabel("Live viewers", { exact: true }),
    ).toContainText("Unavailable");
    await page
      .getByRole("button", { name: "Explore studio example", exact: true })
      .click();
    await expect(monitor).toContainText("synthetic data");
    await expect(monitor).toContainText("54");
    const editor = page.locator(".cf-obs-scene-manager");
    await expect(
      editor.getByLabel("Scene to edit", { exact: true }),
    ).toHaveValue("scene-game");
    await expect(
      editor.getByRole("button", {
        name: "Delete selected scene",
        exact: true,
      }),
    ).toBeDisabled();
    await editor
      .getByRole("button", { name: "Show source Example camera", exact: true })
      .click();
    await expect(
      editor.getByRole("button", {
        name: "Hide source Example camera",
        exact: true,
      }),
    ).toBeEnabled();
    await editor
      .getByRole("button", { name: "Move Example camera down", exact: true })
      .click();
    await expect(
      editor
        .getByRole("list", { name: "Source layer order" })
        .getByRole("listitem")
        .first(),
    ).toContainText("Example game capture");
    await editor
      .getByLabel("Existing source", { exact: true })
      .selectOption("input:input-overlay");
    await editor
      .getByRole("button", { name: "Add existing source", exact: true })
      .click();
    await expect(
      editor.getByRole("button", {
        name: "Remove source Example overlay",
        exact: true,
      }),
    ).toBeEnabled();
    await editor
      .getByRole("button", {
        name: "Remove source Example overlay",
        exact: true,
      })
      .click();
    const confirmation = editor.getByRole("region", {
      name: "Confirm OBS removal",
      exact: true,
    });
    await expect(confirmation).toBeFocused();
    await expect(confirmation).toContainText("Example overlay");
    await confirmation
      .getByRole("button", { name: "Confirm source removal", exact: true })
      .click();
    await expect(
      editor.getByRole("button", {
        name: "Remove source Example overlay",
        exact: true,
      }),
    ).toHaveCount(0);
    await editor.getByLabel("New scene name", { exact: true }).fill("Workshop");
    await editor
      .getByRole("button", { name: "Create scene", exact: true })
      .click();
    await expect(
      editor.getByLabel("Scene to edit", { exact: true }),
    ).not.toHaveValue("scene-game");
    await editor
      .getByLabel("Rename scene name", { exact: true })
      .fill("Workshop renamed");
    await editor
      .getByRole("button", { name: "Rename scene", exact: true })
      .click();
    await expect(
      editor
        .getByLabel("Scene to edit", { exact: true })
        .locator("option:checked"),
    ).toContainText("Workshop renamed");
    await editor
      .getByLabel("Scene copy name", { exact: true })
      .fill("Workshop copy");
    await editor
      .getByRole("button", { name: "Duplicate scene", exact: true })
      .click();
    await expect(
      editor
        .getByLabel("Scene to edit", { exact: true })
        .locator("option:checked"),
    ).toContainText("Workshop copy");
    await mkdir("reports/live-studio-scenes", { recursive: true });
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
        .attach(`live-monitor-${theme}-${width}`, {
          body: await monitor.screenshot({
            path: `reports/live-studio-scenes/monitor-${theme}-${width}.png`,
          }),
          contentType: "image/png",
        });
      await test
        .info()
        .attach(`scene-editor-${theme}-${width}`, {
          body: await editor.screenshot({
            path: `reports/live-studio-scenes/editor-${theme}-${width}.png`,
          }),
          contentType: "image/png",
        });
    }
    await editor
      .getByRole("button", { name: "Delete selected scene", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Confirm scene deletion", exact: true })
      .click();
    await expect(
      editor.getByLabel("Scene to edit", { exact: true }).locator("option"),
    ).not.toContainText(["Workshop copy"]);
    await editor
      .getByLabel("Scene to edit", { exact: true })
      .selectOption("scene-intro");
    await editor
      .getByRole("button", { name: "Take scene live", exact: true })
      .click();
    await expect(
      editor
        .getByLabel("Scene to edit", { exact: true })
        .locator("option:checked"),
    ).toContainText("program");
    await expect(
      page.getByRole("button", { name: "Go live", exact: true }),
    ).toBeDisabled();
  });
